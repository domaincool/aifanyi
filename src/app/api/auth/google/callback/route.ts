import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode } from '@/lib/auth/google';
import { getGuestCookie } from '@/lib/auth/cookie';
import { migrateGuestTasks } from '@/lib/auth/migrate';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    const msg = 'Google 登录失败，请重试。';
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}?login_error=${encodeURIComponent(msg)}`);
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/api/auth/google/callback`;
    const { userId, sessionToken, expiresAt } = await exchangeGoogleCode(code, redirectUri);

    const guestId = await getGuestCookie();
    if (guestId) await migrateGuestTasks(guestId, userId);

    const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/account?login=success`);
    res.cookies.set('aifanyi_session', sessionToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: expiresAt });
    return res;
  } catch (e: any) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}?login_error=${encodeURIComponent('登录失败：' + (e?.message || '未知错误'))}`);
  }
}