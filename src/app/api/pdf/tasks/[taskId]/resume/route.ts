import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startPdfJob } from '@/lib/pdf/translate';
import { getAuthUserId, beginSync, FEATURES } from '@/lib/credit/sync-settle';

export const runtime = 'nodejs';

/**
 * POST /api/pdf/tasks/:taskId/resume — 续做因积分不足暂停的任务
 * 充值后从 jobId 恢复执行（不要求重新上传）
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const job = await prisma.pdfJob.findUnique({ where: { taskId } });
    if (!job) return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });

    const auth = await getAuthUserId();
    if (!auth) return NextResponse.json({ errorType: 'auth_required', message: '请先登录。' }, { status: 401 });
    if (job.userId && job.userId !== auth.userId) {
      return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
    }
    if (job.status !== 'paused') {
      return NextResponse.json({ errorType: 'bad_state', message: '任务状态不支持续做。' }, { status: 400 });
    }

    const est = job.reservedCredits || Math.min(job.pageCount * 2, 200);
    const begin = await beginSync({ userId: auth.userId, jobId: taskId, feature: FEATURES.PDF, estimatedCredits: est });
    if (!begin.ok) {
      const acc = await prisma.creditAccount.findUnique({ where: { userId: auth.userId } });
      return NextResponse.json({ errorType: 'insufficient', message: begin.error, requiredCredits: est, available: acc?.balance ?? 0 }, { status: 402 });
    }

    await prisma.pdfJob.update({
      where: { taskId },
      data: { status: 'queued', creditState: 'reserved', reservedCredits: begin.estimated, errorMessage: null },
    });
    startPdfJob(taskId);
    return NextResponse.json({ ok: true, status: 'queued' });
  } catch (e: any) {
    console.error('[pdf/resume]', e?.message || e);
    return NextResponse.json({ errorType: 'server_error', message: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
