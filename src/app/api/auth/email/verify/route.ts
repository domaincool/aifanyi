import { NextRequest, NextResponse } from 'next/server';
import { verifyOtpAndLogin } from '@/lib/auth/email-otp';
import { getGuestCookie } from '@/lib/auth/cookie';
import { migrateGuestTasks } from '@/lib/auth/migrate';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ ok: false, message: '邮箱和验证码不能为空。' }, { status: 400 });
    }
    if (!/^[0-9]{6}$/.test(code)) {
      return NextResponse.json({ ok: false, message: '验证码为 6 位数字。' }, { status: 400 });
    }

    const result = await verifyOtpAndLogin(email.toLowerCase().trim(), code);
    if (!result.ok) {
      return NextResponse.json(result, { status: 401 });
    }

    // 游客→登录迁移
    const guestId = await getGuestCookie();
    if (guestId && result.userId) {
      await migrateGuestTasks(guestId, result.userId);
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (e: any) {
    console.error('[auth/email/verify] error:', e?.message);
    return NextResponse.json({ ok: false, message: '验证失败，请稍后重试。' }, { status: 500 });
  }
}