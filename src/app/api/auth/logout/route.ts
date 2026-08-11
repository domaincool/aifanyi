import { NextResponse } from 'next/server';
import { getSessionCookie, clearSessionCookie } from '@/lib/auth/cookie';
import { revokeSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  const token = await getSessionCookie();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}