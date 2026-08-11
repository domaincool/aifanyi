/**
 * Email OTP 验证码
 * 生成 6 位数字 → SHA-256 哈希存 DB → nodemailer 发送 → 5 分钟有效 / 一次性使用
 */
import { prisma } from '../db';
import { createSession } from './session';
import { setSessionCookie } from './cookie';

function hashOtp(otp: string): string {
  return require('crypto').createHash('sha256').update(otp).digest('hex');
}

export async function generateAndSendOtp(email: string): Promise<{ ok: boolean; message: string }> {
  // 限流：同一邮箱 1 分钟内只能发一次
  const recent = await prisma.verificationToken.findFirst({
    where: { identifier: email, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent) {
    return { ok: false, message: '验证码发送过于频繁，请 1 分钟后再试。' };
  }

  // 生成 6 位数字 OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const tokenHash = hashOtp(otp);

  // 存 DB（5 分钟有效，一次性）
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      tokenHash,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });

  // 发送邮件
  const sent = await sendOtpEmail(email, otp);
  if (!sent) {
    return { ok: false, message: '验证码发送失败，请稍后重试或使用 Google 登录。' };
  }

  return { ok: true, message: '验证码已发送到 ' + email + '，5 分钟内有效。' };
}

export async function verifyOtpAndLogin(email: string, otp: string): Promise<{ ok: boolean; message: string; userId?: string; sessionToken?: string; expiresAt?: Date }> {
  const tokenHash = hashOtp(otp);

  // 找未使用、未过期的 token
  const token = await prisma.verificationToken.findFirst({
    where: {
      identifier: email,
      tokenHash,
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) {
    return { ok: false, message: '验证码错误或已过期，请重新获取。' };
  }

  // 标记已使用（一次性）
  await prisma.verificationToken.update({ where: { id: token.id }, data: { used: true } });

  // upsert User
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        emailVerified: new Date(),
        nickname: email.split('@')[0],
        authProvider: 'email',
        status: 'active',
        lastLoginAt: new Date(),
      },
    });
  } else if (user.status === 'deleted') {
    return { ok: false, message: '账户已注销，无法登录。如需恢复请联系我们。' };
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), emailVerified: user.emailVerified ?? new Date() },
    });
  }

  // 创建 session
  const { sessionToken, expiresAt } = await createSession(user.id);
  await setSessionCookie(sessionToken, expiresAt);

  return { ok: true, message: '登录成功！', userId: user.id, sessionToken, expiresAt };
}

async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    console.warn('[email-otp] SMTP_HOST 未配置，跳过邮件发送。验证码:', otp);
    return true; // 开发环境不报错
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@aifanyi.com',
      to,
      subject: '爱翻译 AI翻译 · 邮箱验证码',
      text: `您的验证码是：${otp}，5 分钟内有效。请勿将验证码告知他人。`,
      html: `<p>您的验证码是：<strong style="font-size:24px">${otp}</strong></p><p>5 分钟内有效。请勿将验证码告知他人。</p><p>— 爱翻译 aifanyi.com</p>`,
    });
    return true;
  } catch (e: any) {
    console.error('[email-otp] send failed:', e?.message);
    return false;
  }
}