import { NextRequest, NextResponse } from 'next/server';
import { generateAndSendOtp } from '@/lib/auth/email-otp';
import { rateLimit, getClientIp, hashKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, message: '请输入有效的邮箱地址。' }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    // 多维限流：IP（5 次/小时）+ email（3 次/小时，库内还有 60s 冷却）
    const ip = getClientIp(req.headers);
    const ipKey = hashKey(['otp_send', ip]);
    const emailKey = hashKey(['otp_send', normalized]);

    const ipLimit = rateLimit(ipKey, { windowMs: 3600_000, max: 5 });
    if (!ipLimit.ok) {
      return NextResponse.json({ ok: false, message: '请求过于频繁，请稍后再试。' }, { status: 429 });
    }
    const emailLimit = rateLimit(emailKey, { windowMs: 3600_000, max: 3 });
    if (!emailLimit.ok) {
      return NextResponse.json({ ok: false, message: '该邮箱发送次数过多，请 1 小时后再试。' }, { status: 429 });
    }

    const result = await generateAndSendOtp(normalized);
    return NextResponse.json(result, { status: result.ok ? 200 : 429 });
  } catch (e: any) {
    console.error('[auth/email/send] error:', e?.message);
    return NextResponse.json({ ok: false, message: '发送失败，请稍后重试。' }, { status: 500 });
  }
}
