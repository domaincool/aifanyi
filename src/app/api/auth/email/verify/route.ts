import { NextRequest, NextResponse } from 'next/server';
import { verifyOtpAndLogin } from '@/lib/auth/email-otp';
import { getGuestCookie } from '@/lib/auth/cookie';
import { migrateGuestTasks } from '@/lib/auth/migrate';
import { rateLimit, getClientIp, hashKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) return NextResponse.json({ ok: false, message: '邮箱和验证码不能为空。' }, { status: 400 });
    if (!/^[0-9]{6}$/.test(code)) return NextResponse.json({ ok: false, message: '验证码为 6 位数字。' }, { status: 400 });
    const normalized = email.toLowerCase().trim();

    // 验证限流：IP 20 次/小时（防暴力破解）
    const ip = getClientIp(req.headers);
    const ipKey = hashKey(['otp_verify', ip]);
    const ipLimit = rateLimit(ipKey, { windowMs: 3600_000, max: 20 });
    if (!ipLimit.ok) {
      return NextResponse.json({ ok: false, message: '尝试过于频繁，请稍后再试。' }, { status: 429 });
    }

    const result = await verifyOtpAndLogin(normalized, code);
    if (!result.ok) return NextResponse.json(result, { status: 401 });

    const guestId = await getGuestCookie();
    if (guestId && result.userId) await migrateGuestTasks(guestId, result.userId);

    const res = NextResponse.json({ ok: true, message: result.message });
    res.cookies.set('aifanyi_session', result.sessionToken!, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: result.expiresAt! });
    return res;
  } catch (e: any) {
    console.error('[auth/email/verify] error:', e?.message);
    return NextResponse.json({ ok: false, message: '验证失败，请稍后重试。' }, { status: 500 });
  }
}
