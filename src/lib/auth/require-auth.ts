import { NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { AuthContext } from './types';
import { MSG_AUTH } from '@/lib/credit/sync-settle';

/** 验证登录态，未登录返回 401 */
export async function requireAuth(): Promise<{ user: AuthContext } | NextResponse> {
  const token = await getSessionCookie();
  if (!token) return NextResponse.json({ error: MSG_AUTH }, { status: 401 });
  const user = await validateSession(token);
  if (!user) return NextResponse.json({ error: MSG_AUTH + '（会话已过期，请重新登录）' }, { status: 401 });
  return { user };
}