/**
 * GET /api/pdf/tasks/:taskId
 * 前端 1-2s 轮询进度；completed 返回完整 Document Model（含译文）
 * Phase 0 加固：Ownership Check（登录用户/游客必须与任务归属匹配，否则 404）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPdfJob } from '@/lib/pdf/job';
import { prisma } from '@/lib/db';
import { getSessionCookie, getGuestCookie } from '@/lib/auth/cookie';
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
