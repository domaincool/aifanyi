import { NextRequest, NextResponse } from 'next/server';
import { generateAndSendOtp } from '@/lib/auth/email-otp';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, message: '请输入有效的邮箱地址。' }, { status: 400 });
    }
    const result = await generateAndSendOtp(email.toLowerCase().trim());
    return NextResponse.json(result, { status: result.ok ? 200 : 429 });
  } catch (e: any) {
    console.error('[auth/email/send] error:', e?.message);
    return NextResponse.json({ ok: false, message: '发送失败，请稍后重试。' }, { status: 500 });
  }
}