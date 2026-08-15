import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { endSyncFail } from '@/lib/credit/sync-settle';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const job = await prisma.subtitleJob.findUnique({ where: { taskId } });
    if (!job) return NextResponse.json({ ok: false, error: '任务不存在。' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      task: {
        taskId: job.taskId,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        totalCues: job.totalCues,
        translatedCues: job.translatedCues,
        errorType: job.errorType,
        errorMessage: job.errorMessage,
        durationMs: job.durationMs,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
      cues: job.status === 'completed' ? ((job.document as any)?.cues || []) : null,
    });
  } catch (e: any) {
    console.error('[subtitle/tasks]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙。' }, { status: 500 });
  }
}

/**
 * PATCH /api/subtitle/tasks/:taskId — 取消任务（未完成全量退回积分）
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const job = await prisma.subtitleJob.findUnique({ where: { taskId } });
    if (!job) return NextResponse.json({ ok: false, error: '任务不存在。' }, { status: 404 });

    // 归属校验
    const token = await getSessionCookie();
    const session = token ? await validateSession(token).catch(() => null) : null;
    if (job.userId && (!session || session.userId !== job.userId)) {
      return NextResponse.json({ ok: false, error: '任务不存在。' }, { status: 404 });
    }

    if (job.status !== 'queued' && job.status !== 'processing') {
      return NextResponse.json({ ok: false, error: '任务已结束，无法取消。' }, { status: 400 });
    }

    await prisma.subtitleJob.update({
      where: { taskId },
      data: { status: 'cancelled', errorMessage: '任务已取消，已用积分已退回。', creditState: 'released' },
    });

    if (job.userId && (job.reservedCredits || 0) > 0) {
      const usage = await prisma.usageRecord.findFirst({ where: { jobId: taskId }, select: { id: true } });
      if (usage) {
        await endSyncFail({ userId: job.userId, jobId: taskId, usageId: usage.id, estimated: job.reservedCredits });
      }
    }

    return NextResponse.json({ ok: true, status: 'cancelled' });
  } catch (e: any) {
    console.error('[subtitle/tasks PATCH]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
