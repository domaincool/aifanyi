import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getGoogleAuthUrl } from '@/lib/auth/google';

export const runtime = 'nodejs';

const STATE_COOKIE = 'aifanyi_oauth_state';

export async function GET() {
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/api/auth/google/callback`;
  const state = randomBytes(32).toString('hex');
  const url = getGoogleAuthUrl(redirectUri, state);

  const res = NextResponse.redirect(url);
  // state 存 httpOnly cookie（30 分钟有效），callback 校验防 CSRF
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 1800 });
  return res;
}
