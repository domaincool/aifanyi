/**
 * GET /api/pdf/tasks/:taskId
 * 前端 1-2s 轮询进度；completed 返回完整 Document Model（含译文）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPdfJob } from '@/lib/pdf/job';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const job = await getPdfJob(taskId);
  if (!job) {
    return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
  }
  return NextResponse.json(job);
}