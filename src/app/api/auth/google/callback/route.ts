import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode } from '@/lib/auth/google';
import { getGuestCookie } from '@/lib/auth/cookie';
import { migrateGuestTasks } from '@/lib/auth/migrate';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    const msg = error === 'access_denied' ? '您取消了 Google 授权。' : 'Google 登录失败，请重试。';
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}?login_error=${encodeURIComponent(msg)}`);
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/api/auth/google/callback`;
    const userId = await exchangeGoogleCode(code, redirectUri);

    // 游客→登录迁移
    const guestId = await getGuestCookie();
    if (guestId) {
      await migrateGuestTasks(guestId, userId);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/account?login=success`);
  } catch (e: any) {
    console.error('[auth/google/callback] error:', e?.message);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}?login_error=${encodeURIComponent('登录失败：' + (e?.message || '未知错误'))}`);
  }
}