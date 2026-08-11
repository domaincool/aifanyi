import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const q = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type') || ''; // completed / processing / failed
  const sort = url.searchParams.get('sort') || 'createdAt';
  const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  const where: Record<string, unknown> = { userId: auth.user.userId };
  if (q) where.fileName = { contains: q, mode: 'insensitive' };
  if (type) where.status = type;
  // allowed sort columns
  const allowedSort = ['createdAt', 'updatedAt', 'pageCount', 'sourceLang'];
  const sortCol = allowedSort.includes(sort) ? sort : 'createdAt';

  const [jobs, total] = await Promise.all([
    prisma.pdfJob.findMany({
      where: where as any,
      orderBy: { [sortCol]: order },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        taskId: true, fileName: true, pageCount: true, sourceLang: true, targetLang: true,
        status: true, createdAt: true, updatedAt: true, saved: true, expiresAt: true,
      },
    }),
    prisma.pdfJob.count({ where: where as any }),
  ]);

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      ...j,
      canAccess: j.status === 'completed',
      expiresIn: j.expiresAt ? Math.max(0, Math.floor((j.expiresAt.getTime() - Date.now()) / 3600_000)) : null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}