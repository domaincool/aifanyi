/**
 * Session 管理：创建 / 验证 / 撤销 / 清理过期
 * JWT + DB 双写：Cookie 存 JWT（快速验证），DB 存 Session 记录（支持主动撤销）
 */
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '../db';
import { AuthContext } from './types';

const encoder = new TextEncoder();

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET 环境变量未设置');
  return encoder.encode(s);
}

export async function createSession(userId: string): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000);

  const sessionToken = await new SignJWT({ sub: userId as string, jti: sessionId } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  await prisma.session.create({
    data: { sessionToken, userId, expiresAt },
  });

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  return { sessionToken, expiresAt };
}

export async function validateSession(sessionToken: string): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(sessionToken, getSecret());
    const userId = payload.sub;
    if (!userId) return null;

    const session = await prisma.session.findUnique({ where: { sessionToken } });
    if (!session || session.expiresAt < new Date()) return null;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') return null;

    return {
      userId: user.id,
      email: user.email ?? undefined,
      nickname: user.nickname ?? undefined,
      avatar: user.avatar ?? undefined,
      authProvider: user.authProvider ?? undefined,
      status: user.status,
    };
  } catch {
    return null;
  }
}

export async function revokeSession(sessionToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { sessionToken } });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}