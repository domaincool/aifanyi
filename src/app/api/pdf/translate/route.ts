/**
 * POST /api/pdf/translate
 * 上传 PDF → 限制校验 → 解析 → 认证注入 → 创建 PdfJob（queued）
 * 游客/登录用户差异化积分 + 自动记账 UsageLedger
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { parsePdf } from '@/lib/pdf/parser';
import { createPdfJob, cleanupExpiredPdfJobs } from '@/lib/pdf/job';
import { startPdfJob } from '@/lib/pdf/translate';
import { checkGlobalDailyCap } from '@/lib/pdf/quota';
import { checkFairUse, clientKeyOf } from '@/lib/fairuse-quota';
import { PdfError } from '@/lib/pdf/types';
import { PDF_CONFIG } from '@/lib/pdf/config';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { getOrCreateGuestCookie } from '@/lib/auth/cookie';
import { prisma } from '@/lib/db';
import { getAuthUserId, beginSync, endSyncSuccess, endSyncFail, FEATURES } from '@/lib/credit/sync-settle';
import { isCreditDeductionEnabled } from '@/lib/credit/feature-flags';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  try {
    const auth = await getAuthUserId();
    // 方案 A（2026-09-01 拍板）：flag off 放开游客文件工具（fairuse 游客线兜底）；
    // flag on 回退旧行为（强制登录）
    if (!auth && isCreditDeductionEnabled()) {
      return NextResponse.json({ errorType: 'auth_required', message: '请先登录后再使用该功能。免费注册解锁双倍每日额度。' }, { status: 401 });
    }
    const userId = auth?.userId ?? null;
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ errorType: 'parse_failed', message: '未收到文件，请重新上传。' }, { status: 400 });
    }
    const pdfFile = file as File;
    const fileName = pdfFile.name || 'document.pdf';

    if (pdfFile.size > PDF_CONFIG.maxFileBytes) {
      return NextResponse.json({ errorType: 'oversize', message: `文件过大（${(pdfFile.size / 1024 / 1024).toFixed(1)}MB），单文件上限 ${PDF_CONFIG.maxFileBytes / 1024 / 1024}MB。` }, { status: 413 });
    }
    if (pdfFile.size === 0) {
      return NextResponse.json({ errorType: 'corrupt', message: '文件为空，无法解析。' }, { status: 400 });
    }

    const buffer = await pdfFile.arrayBuffer();
    const doc = await parsePdf(buffer, fileName);

    // 身份：登录用 userId；游客用统一 clientKey（fairuse 游客线）
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const clientKey = clientKeyOf(ip, ua);
    const guestSessionId: string | null = userId ? null : clientKey;

    if (!(await checkGlobalDailyCap())) {
      return NextResponse.json({ errorType: 'quota_exceeded', message: '今日服务繁忙，请明天再试。' }, { status: 429 });
    }

    // B2 公平使用双阈值（登录：10 文件/100 页硬阈值，软阈值打点）
    const fu = await checkFairUse({ userId, clientKey, pages: doc.pageCount });
    if (!fu.ok) {
      return NextResponse.json({ errorType: 'fair_use_limit_reached', message: fu.message }, { status: 429 });
    }

    const taskId = `pdf_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

    // 积分：2/页（封顶 200）→ reserve（原子检查余额）
    const estCredits = Math.min(doc.pageCount * 2, 200);
    const begin = await beginSync({ userId, jobId: taskId, feature: FEATURES.PDF, estimatedCredits: estCredits });
    if (!begin.ok) {
      // 余额不足：保存为 paused 任务，充值后从 taskId 续做（不要求重新上传）
      await createPdfJob({ taskId, fileName, fileSize: pdfFile.size, doc, clientKey, userId, guestSessionId, creditState: 'paused', reservedCredits: estCredits, status: 'paused' });
      const acc = await prisma.creditAccount.findUnique({ where: { userId: userId! } });
      return NextResponse.json({
        taskId,
        status: 'paused',
        pageCount: doc.pageCount,
        totalBlocks: doc.pages.reduce((s, p) => s + p.blocks.length, 0),
        totalCharacters: doc.totalCharacters,
        sourceLang: doc.sourceLang,
        targetLang: doc.targetLang,
        limitations: doc.limitations,
        requiredCredits: estCredits,
        available: acc?.balance ?? 0,
        message: '本次翻译预计消耗约 ' + estCredits + ' 积分，当前剩余 ' + (acc?.balance ?? 0) + ' 积分。任务已保存，充值后可直接续做，无需重新上传。',
      });
    }
    creditCtx = { jobId: taskId, usageId: begin.usageId, estimated: begin.estimated, userId: userId! };

    await createPdfJob({ taskId, fileName, fileSize: pdfFile.size, doc, clientKey, userId, guestSessionId, creditState: 'reserved', reservedCredits: estCredits });

    // 记账（用户或游客）
    await prisma.usageLedger.create({
      data: {
        userId,
        guestSessionId,
        type: 'pdf_translation',
        amount: 1,
        unit: 'files',
        taskId,
        description: `${fileName} (${doc.pageCount}页)`,
      },
    });

    startPdfJob(taskId);
    void cleanupExpiredPdfJobs().catch(() => {});

    return NextResponse.json({
      taskId,
      status: 'queued',
      pageCount: doc.pageCount,
      totalBlocks: doc.pages.reduce((s, p) => s + p.blocks.length, 0),
      totalCharacters: doc.totalCharacters,
      sourceLang: doc.sourceLang,
      targetLang: doc.targetLang,
      limitations: doc.limitations,
      isAuthenticated: !!userId,
    });
  } catch (e: any) {
    if (creditCtx) await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated });
    if (e instanceof PdfError) {
      return NextResponse.json({ errorType: e.errorType, message: e.message }, { status: e.errorType === 'oversize' ? 413 : 422 });
    }
    console.error('[pdf/translate] unexpected:', e?.message || e);
    return NextResponse.json({ errorType: 'parse_failed', message: 'PDF 解析失败，请稍后重试或换一个文件。' }, { status: 500 });
  }
}