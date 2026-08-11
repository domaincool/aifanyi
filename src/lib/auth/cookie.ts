/**
 * Cookie 工具：HttpOnly / Secure / SameSite Lax
 * 登录用户：aifanyi_session（JWT，30天）
 * 游客模式：aifanyi_guest（随机 sessionId，浏览器会话级）
 */
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'aifanyi_session';
const GUEST_COOKIE = 'aifanyi_guest';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

export async function setSessionCookie(sessionToken: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionToken, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export async function getSessionCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** 游客 cookie：浏览器会话级（关闭浏览器即失效） */
export async function setGuestCookie(guestSessionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(GUEST_COOKIE, guestSessionId, { ...COOKIE_OPTIONS, maxAge: 86400 }); // 24h
}

export async function getGuestCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value;
}

export async function clearGuestCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(GUEST_COOKIE);
}

export async function getOrCreateGuestCookie(): Promise<string> {
  const existing = await getGuestCookie();
  if (existing) return existing;
  const id = `guest_${crypto.randomUUID()}`;
  await setGuestCookie(id);
  return id;
}