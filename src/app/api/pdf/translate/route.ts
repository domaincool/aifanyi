/**
 * POST /api/pdf/translate
 * 上传 PDF → 限制校验 → 解析 → 认证注入 → 创建 PdfJob（queued）
 * 游客/登录用户差异化额度 + 自动记账 UsageLedger
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { parsePdf } from '@/lib/pdf/parser';
import { createPdfJob, cleanupExpiredPdfJobs } from '@/lib/pdf/job';
import { startPdfJob } from '@/lib/pdf/translate';
import { checkPdfQuota, checkGlobalDailyCap } from '@/lib/pdf/quota';
import { PdfError } from '@/lib/pdf/types';
import { PDF_CONFIG } from '@/lib/pdf/config';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { getOrCreateGuestCookie } from '@/lib/auth/cookie';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
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

    // 认证注入
    let userId: string | null = null;
    let guestSessionId: string | null = null;
    const sessionToken = await getSessionCookie();
    if (sessionToken) {
      const user = await validateSession(sessionToken);
      if (user) userId = user.userId;
    }
    if (!userId) {
      guestSessionId = await getOrCreateGuestCookie();
    }

    // 额度校验
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const clientKey = require('crypto').createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);

    const quota = await checkPdfQuota(clientKey, doc.pageCount, userId, guestSessionId);
    if (!quota.ok) {
      return NextResponse.json({ errorType: 'quota_exceeded', message: quota.reason }, { status: 429 });
    }
    if (!(await checkGlobalDailyCap())) {
      return NextResponse.json({ errorType: 'quota_exceeded', message: '今日服务繁忙，请明天再试。' }, { status: 429 });
    }

    const taskId = `pdf_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
    await createPdfJob({ taskId, fileName, fileSize: pdfFile.size, doc, clientKey, userId, guestSessionId });

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
    if (e instanceof PdfError) {
      return NextResponse.json({ errorType: e.errorType, message: e.message }, { status: e.errorType === 'oversize' ? 413 : 422 });
    }
    console.error('[pdf/translate] unexpected:', e?.message || e);
    return NextResponse.json({ errorType: 'parse_failed', message: 'PDF 解析失败，请稍后重试或换一个文件。' }, { status: 500 });
  }
}