/**
 * Session 管理：JWT + DB 双写（Node crypto API，无需 jose）
 * Phase 0 加固：SESSION_SECRET 惰性校验（build 阶段不抛错，运行时强校验）
 */
import { prisma } from '../db';
import { AuthContext } from './types';

const SECRET_KEY = process.env.SESSION_CRET || '';

/** 惰性校验：真正签名/验签时才要求强密钥（避免 next build 收集 page data 时因 env 缺失中断） */
function requireSecretKey(): string {
  if (!SECRET_KEY || SECRET_KEY.length < 32) {
    throw new Error('[auth] SESSION_SECRET 未配置或长度不足 32 字符（安全策略：拒绝使用弱密钥）。请在生产环境设置强随机 SESSION_SECRET。');
  }
  return SECRET_KEY;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function signJwt(payload: Record<string, unknown>, expiresAt: Date): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(expiresAt.getTime() / 1000) })));
  const hmac = require('crypto').createHmac('sha256', requireSecretKey()).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64url(hmac)}`;
}

function verifyJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const hmac = require('crypto').createHmac('sha256', requireSecretKey()).update(`${parts[0]}.${parts[1]}`).digest();
    if (base64url(hmac) !== parts[2]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function createSession(userId: string): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionId = require('crypto').randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000);

  const sessionToken = signJwt({ sub: userId, jti: sessionId }, expiresAt);

  await prisma.session.create({ data: { sessionToken, userId, expiresAt, lastUsedAt: new Date() } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  return { sessionToken, expiresAt };
}

export async function validateSession(sessionToken: string): Promise<AuthContext | null> {
  const payload = verifyJwt(sessionToken);
  if (!payload || !payload.sub) return null;

  const session = await prisma.session.findUnique({ where: { sessionToken } });
  if (!session || session.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
  if (!user || user.status !== 'active') return null;

  return {
    userId: user.id, email: user.email ?? undefined, nickname: user.nickname ?? undefined,
    avatar: user.avatar ?? undefined, authProvider: user.authProvider ?? undefined, status: user.status,
  };
}

export async function revokeSession(sessionToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { sessionToken } });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
