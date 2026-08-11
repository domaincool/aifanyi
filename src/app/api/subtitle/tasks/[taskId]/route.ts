import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
