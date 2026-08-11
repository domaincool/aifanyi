import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateGuestCookie } from '@/lib/auth/cookie';
import { parseSubtitle } from '@/lib/subtitle-lib';
import { checkSubtitleQuota, runSubtitleJob } from '@/lib/subtitle-job';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CUES = 2000;

export async function POST(req: NextRequest) {
  try {
    // 身份：优先登录态（cookie session），否则 guest cookie
    let userId: string | null = null;
    let guestSessionId: string | null = null;
    const { getSessionCookie } = await import('@/lib/auth/cookie');
    const { validateSession } = await import('@/lib/auth/session');
    const token = await getSessionCookie();
    const session = token ? await validateSession(token).catch(() => null) : null;
    if (session?.userId) userId = session.userId;
    const guest = await getOrCreateGuestCookie();
    if (guest) guestSessionId = guest;

    const clientKey = (req.headers.get('x-forwarded-for') || 'local') + '|' + (req.headers.get('user-agent') || '').slice(0, 80);
    const quota = await checkSubtitleQuota(clientKey);
    if (!quota.ok) {
      return NextResponse.json({ ok: false, error: `今日免费额度已用完（${quota.used}/${quota.limit} 个文件），请明天再来。` }, { status: 429 });
    }

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

    const taskId = 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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
      },
    });

    // 后台异步翻译（fire-and-forget）
    runSubtitleJob(taskId).catch(e => console.error('[subtitle] 后台任务异常', e));

    return NextResponse.json({ ok: true, taskId, totalCues: cues.length });
  } catch (e: any) {
    console.error('[subtitle/translate]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
