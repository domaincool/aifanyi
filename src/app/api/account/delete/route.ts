import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-auth';
import { revokeAllUserSessions } from '@/lib/auth/session';
import { clearSessionCookie } from '@/lib/auth/cookie';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.user.userId;

  await prisma.user.update({ where: { id: userId }, data: { status: 'deleted' } });
  await revokeAllUserSessions(userId);
  await prisma.pdfJob.updateMany({ where: { userId }, data: { document: Prisma.JsonNull, saved: false } });
  await prisma.documentProgress.deleteMany({ where: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { email: null, nickname: null, avatar: null, emailVerified: null } });
  await prisma.verificationToken.deleteMany({ where: { identifier: auth.user.email || '' } });
  await clearSessionCookie();

  return NextResponse.json({ ok: true, message: '账户已注销。感谢使用爱翻译。' });
}