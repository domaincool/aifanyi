import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runSubtitleJob } from '@/lib/subtitle-job';
import { getAuthUserId, beginSync, FEATURES } from '@/lib/credit/sync-settle';

export const runtime = 'nodejs';

/**
 * POST /api/subtitle/tasks/:taskId/resume — 续做因积分不足暂停的任务
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const job = await prisma.subtitleJob.findUnique({ where: { taskId } });
    if (!job) return NextResponse.json({ ok: false, error: '任务不存在。' }, { status: 404 });

    const auth = await getAuthUserId();
    if (!auth) return NextResponse.json({ ok: false, error: '请先登录。' }, { status: 401 });
    if (job.userId && job.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: '任务不存在。' }, { status: 404 });
    }
    if (job.status !== 'paused') {
      return NextResponse.json({ ok: false, error: '任务状态不支持续做。' }, { status: 400 });
    }

    const est = job.reservedCredits || 300;
    const begin = await beginSync({ userId: auth.userId, jobId: taskId, feature: FEATURES.SUBTITLE, estimatedCredits: est });
    if (!begin.ok) {
      const acc = await prisma.creditAccount.findUnique({ where: { userId: auth.userId } });
      return NextResponse.json({ ok: false, code: 'insufficient', error: begin.error, requiredCredits: est, available: acc?.balance ?? 0 }, { status: 402 });
    }

    await prisma.subtitleJob.update({
      where: { taskId },
      data: { status: 'queued', creditState: 'reserved', reservedCredits: begin.estimated, errorMessage: null },
    });
    runSubtitleJob(taskId).catch(e => console.error('[subtitle] 续做后台任务异常', e));
    return NextResponse.json({ ok: true, status: 'queued' });
  } catch (e: any) {
    console.error('[subtitle/resume]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
