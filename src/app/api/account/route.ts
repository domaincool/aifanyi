import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const [jobCount, recentJobs] = await Promise.all([
    prisma.pdfJob.count({ where: { userId: user.userId } }),
    prisma.pdfJob.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { taskId: true, fileName: true, status: true, pageCount: true, sourceLang: true, targetLang: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    user: {
      id: user.userId,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      authProvider: user.authProvider,
    },
    stats: { totalTranslations: jobCount },
    recentJobs,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.nickname === 'string' && body.nickname.length <= 50) patch.nickname = body.nickname;
  if (typeof body.avatar === 'string' && body.avatar.length <= 500) patch.avatar = body.avatar;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: '无有效更新字段' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: auth.user.userId }, data: patch });
  return NextResponse.json({ ok: true });
}