/**
 * GET /api/pdf/tasks/:taskId
 * 前端 1-2s 轮询进度；completed 返回完整 Document Model（含译文）
 * Phase 0 加固：Ownership Check（登录用户/游客必须与任务归属匹配，否则 404）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPdfJob } from '@/lib/pdf/job';
import { prisma } from '@/lib/db';
import { getSessionCookie, getGuestCookie } from '@/lib/auth/cookie';
import { endSyncFail } from '@/lib/credit/sync-settle';
import { validateSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;

  // 先查归属字段做 Ownership Check（不泄露存在性）
  const owner = await prisma.pdfJob.findUnique({
    where: { taskId },
    select: { taskId: true, userId: true, guestSessionId: true },
  });
  if (!owner) {
    return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
  }

  const sessionToken = await getSessionCookie();
  let userId: string | null = null;
  if (sessionToken) {
    const user = await validateSession(sessionToken);
    if (user) userId = user.userId;
  }
  const guestSessionId = await getGuestCookie();

  if (owner.userId && owner.userId !== userId) {
    return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
  }
  if (!owner.userId && owner.guestSessionId && owner.guestSessionId !== guestSessionId) {
    return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
  }

  const job = await getPdfJob(taskId);
  if (!job) {
    return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
  }
  return NextResponse.json(job);
}

/**
 * PATCH /api/pdf/tasks/:taskId — 取消任务（未完成全量退回额度）
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const job = await prisma.pdfJob.findUnique({ where: { taskId } });
    if (!job) return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });

    // 归属校验（与 GET 一致）
    const sessionToken = await getSessionCookie();
    let userId: string | null = null;
    if (sessionToken) {
      const user = await validateSession(sessionToken);
      if (user) userId = user.userId;
    }
    if (job.userId && job.userId !== userId) {
      return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
    }

    if (job.status !== 'queued' && job.status !== 'processing') {
      return NextResponse.json({ ok: false, error: '任务已结束，无法取消。' }, { status: 400 });
    }

    await prisma.pdfJob.update({
      where: { taskId },
      data: { status: 'cancelled', errorMessage: '任务已取消，已用额度已退回。', creditState: 'released' },
    });

    // 额度全退（幂等）
    if (job.userId && (job.reservedCredits || 0) > 0) {
      const usage = await prisma.usageRecord.findFirst({ where: { jobId: taskId }, select: { id: true } });
      if (usage) {
        await endSyncFail({ userId: job.userId, jobId: taskId, usageId: usage.id, estimated: job.reservedCredits });
      }
    }

    return NextResponse.json({ ok: true, status: 'cancelled' });
  } catch (e: any) {
    console.error('[pdf/tasks PATCH]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
