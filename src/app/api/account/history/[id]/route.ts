import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const job = await prisma.pdfJob.findFirst({ where: { taskId: id, userId: auth.user.userId } });
  if (!job) return NextResponse.json({ error: '翻译任务不存在' }, { status: 404 });

  return NextResponse.json({
    taskId: job.taskId, fileName: job.fileName, pageCount: job.pageCount,
    sourceLang: job.sourceLang, targetLang: job.targetLang, status: job.status,
    createdAt: job.createdAt, updatedAt: job.updatedAt, saved: job.saved, expiresAt: job.expiresAt,
    result: job.status === 'completed' && job.document ? job.document : null,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const job = await prisma.pdfJob.findFirst({ where: { taskId: id, userId: auth.user.userId } });
  if (!job) return NextResponse.json({ error: '翻译任务不存在' }, { status: 404 });

  await prisma.pdfJob.update({ where: { id: job.id }, data: { document: Prisma.JsonNull, saved: false } });
  return NextResponse.json({ ok: true });
}