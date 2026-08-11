import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode } from '@/lib/auth/google';
import { getGuestCookie } from '@/lib/auth/cookie';
import { migrateGuestTasks } from '@/lib/auth/migrate';

export const runtime = 'nodejs';

const STATE_COOKIE = 'aifanyi_oauth_state';

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com';
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  // state 校验：防 OAuth CSRF / Authorization Code Injection
  if (!state || !cookieState || state !== cookieState) {
    const res = NextResponse.redirect(`${site}?login_error=${encodeURIComponent('登录状态校验失败，请重新登录。')}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!code) {
    const msg = 'Google 登录失败，请重试。';
    const res = NextResponse.redirect(`${site}?login_error=${encodeURIComponent(msg)}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  try {
    const redirectUri = `${site}/api/auth/google/callback`;
    const { userId, sessionToken, expiresAt } = await exchangeGoogleCode(code, redirectUri);

    const guestId = await getGuestCookie();
    if (guestId) await migrateGuestTasks(guestId, userId);

    // ?next= 回跳：登录前所在页面（aifanyi_next cookie，仅同站相对路径）
    const next = req.cookies.get('aifanyi_next')?.value;
    const dest = next && next.startsWith('/') ? `${site}${next}` : `${site}/account?login=success`;
    const res = NextResponse.redirect(dest);
    res.cookies.set('aifanyi_session', sessionToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: expiresAt });
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete('aifanyi_next');
    return res;
  } catch (e: any) {
    // 用户侧只给通用错误，细节记服务端日志
    console.error('[auth/google/callback]', e?.message || e);
    const res = NextResponse.redirect(`${site}?login_error=${encodeURIComponent('Google 登录失败，请重试。')}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }
}
