import { NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { revokeSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  const token = await getSessionCookie();
  if (token) await revokeSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('aifanyi_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}