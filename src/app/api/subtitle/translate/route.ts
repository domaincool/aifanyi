import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateGuestCookie } from '@/lib/auth/cookie';
import { parseSubtitle } from '@/lib/subtitle-lib';
import { runSubtitleJob } from '@/lib/subtitle-job';
import { getAuthUserId, beginSync, endSyncSuccess, endSyncFail, FEATURES } from '@/lib/credit/sync-settle';
import { isCreditDeductionEnabled } from '@/lib/credit/feature-flags';
import { checkFairUse, clientKeyOf } from '@/lib/fairuse-quota';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CUES = 2000;

export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  try {
    const auth = await getAuthUserId();
    // 方案 A（2026-09-01 拍板）：flag off 放开游客文件工具（fairuse 游客线兜底）；
    // flag on 回退旧行为（强制登录）
    if (!auth && isCreditDeductionEnabled()) {
      return NextResponse.json({ ok: false, code: 'auth_required', error: '请先登录后再使用该功能。免费注册解锁双倍每日额度。' }, { status: 401 });
    }
    const userId = auth?.userId ?? null;
    // 身份：登录用 userId；游客用统一 clientKey（fairuse 游客线）
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
    const ua = req.headers.get('user-agent') || '';
    const clientKey = clientKeyOf(ip, ua);
    const guestSessionId: string | null = userId ? null : clientKey;
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const targetLang = String(form.get('targetLang') || 'zh');

    if (!file || !file.name) {
      return NextResponse.json({ ok: false, error: '请选择字幕文件。' }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!/\.(srt|vtt)$/.test(name)) {
      return NextResponse.json({ ok: false, error: '仅支持 SRT / VTT 字幕文件。' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: '文件过大（限 5MB）。' }, { status: 400 });
    }

    const raw = await file.text();
    const { cues, format, error } = parseSubtitle(raw);
    if (error || cues.length === 0) {
      return NextResponse.json({ ok: false, error: error || '无法解析字幕。' }, { status: 400 });
    }
    if (cues.length > MAX_CUES) {
      return NextResponse.json({ ok: false, error: `字幕条目过多（${cues.length} 条，上限 ${MAX_CUES} 条）。` }, { status: 400 });
    }

    // B2 公平使用双阈值（登录：10 文件/日硬阈值，软阈值打点）
    const fu = await checkFairUse({ userId, clientKey });
    if (!fu.ok) {
      return NextResponse.json({ ok: false, code: 'fair_use_limit_reached', error: fu.message }, { status: 429 });
    }

    const taskId = 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // 积分：按字幕时长 1/分钟 → reserve（原子检查余额）
    const first = cues[0], last = cues[cues.length - 1];
    const parseTime = (t: string): number => {
      const mm = t.match(/(\d+):(\d{2}):(\d{2})[,.]?(\d{0,3})/);
      if (!mm) return 0;
      return (+mm[1]) * 3600 + (+mm[2]) * 60 + (+mm[3]) + (+(mm[4] || '0')) / 1000;
    };
    const durationSec = Math.max(0, parseTime(last.end) - parseTime(first.start));
    const durationMin = Math.max(1, Math.round(durationSec / 60) || 1);
    const estCredits = Math.min(durationMin, 300);
    const begin = await beginSync({ userId, jobId: taskId, feature: FEATURES.SUBTITLE, estimatedCredits: estCredits });
    if (!begin.ok) {
      // 余额不足：保存为 paused 任务，充值后从 taskId 续做
      await prisma.subtitleJob.create({
        data: {
          taskId, fileName: file.name, fileSize: file.size, targetLang,
          status: 'paused', totalCues: cues.length,
          document: { format, cues } as unknown as object,
          clientKey, userId, guestSessionId,
          creditState: 'paused', reservedCredits: estCredits,
        },
      });
      const acc = await prisma.creditAccount.findUnique({ where: { userId: userId! } });
      return NextResponse.json({ ok: true, taskId, status: 'paused', totalCues: cues.length, requiredCredits: estCredits, available: acc?.balance ?? 0, message: '本次翻译预计消耗约 ' + estCredits + ' 积分，当前剩余 ' + (acc?.balance ?? 0) + ' 积分。任务已保存，充值后可直接续做。' });
    }
    creditCtx = { jobId: taskId, usageId: begin.usageId, estimated: begin.estimated, userId: userId! };

    await prisma.subtitleJob.create({
      data: {
        taskId,
        fileName: file.name,
        fileSize: file.size,
        targetLang,
        status: 'queued',
        totalCues: cues.length,
        document: { format, cues } as unknown as object,
        clientKey,
        userId,
        guestSessionId,
        creditState: 'reserved',
        reservedCredits: estCredits,
      },
    });

    // 后台异步翻译（fire-and-forget）
    runSubtitleJob(taskId).catch(e => console.error('[subtitle] 后台任务异常', e));

    return NextResponse.json({ ok: true, taskId, totalCues: cues.length });
  } catch (e: any) {
    if (creditCtx) await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated });
    console.error('[subtitle/translate]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
