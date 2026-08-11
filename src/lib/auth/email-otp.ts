/**
 * Email OTP 验证码
 * 生成 6 位数字 → SHA-256 哈希存 DB → nodemailer 发送 → 5 分钟有效 / 一次性 / 最多验证 5 次
 * Phase 1：attempts 计数（≤5 次验证）、发送限流（email 维度 60s + IP 维度由 route 层处理）
 */
import { prisma } from '../db';
import { createSession } from './session';

const MAX_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60_000; // 10 分钟

function hashOtp(otp: string): string {
  return require('crypto').createHash('sha256').update(otp).digest('hex');
}

export async function generateAndSendOtp(email: string): Promise<{ ok: boolean; message: string }> {
  const recent = await prisma.verificationToken.findFirst({
    where: { identifier: email, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent) {
    return { ok: false, message: '验证码发送过于频繁，请 1 分钟后再试。' };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const tokenHash = hashOtp(otp);

  await prisma.verificationToken.create({
    data: { identifier: email, tokenHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const sent = await sendOtpEmail(email, otp);
  if (!sent) {
    return { ok: false, message: '验证码发送失败，请稍后重试或使用 Google 登录。' };
  }

  return { ok: true, message: '验证码已发送到 ' + email + '，10 分钟内有效。' };
}

export async function verifyOtpAndLogin(email: string, otp: string): Promise<{ ok: boolean; message: string; userId?: string; sessionToken?: string; expiresAt?: Date }> {
  const tokenHash = hashOtp(otp);

  // 找该邮箱最新未使用且未过期的 token
  const token = await prisma.verificationToken.findFirst({
    where: { identifier: email, used: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) {
    return { ok: false, message: '验证码错误或已过期，请重新获取。' };
  }

  // attempts 上限：5 次
  if (token.attempts >= MAX_ATTEMPTS) {
    await prisma.verificationToken.update({ where: { id: token.id }, data: { used: true } });
    return { ok: false, message: '验证次数过多，请重新获取验证码。' };
  }

  if (token.tokenHash !== tokenHash) {
    await prisma.verificationToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    const remain = MAX_ATTEMPTS - token.attempts - 1;
    return { ok: false, message: `验证码错误，还可尝试 ${Math.max(remain, 0)} 次。` };
  }

  // 验证成功：标记使用
  await prisma.verificationToken.update({ where: { id: token.id }, data: { used: true } });

  // find-or-create User（verified email）
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, emailVerified: new Date(), nickname: email.split('@')[0], status: 'active', lastLoginAt: new Date() },
    });
  } else if (user.status === 'deleted') {
    return { ok: false, message: '账户已注销，无法登录。如需恢复请联系我们。' };
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), emailVerified: user.emailVerified ?? new Date() } });
  }

  // 确保 email 身份存在（Phase 1：AuthIdentity）
  const identityExists = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: 'email', providerAccountId: email } },
  });
  if (!identityExists) {
    await prisma.authIdentity.create({
      data: { userId: user.id, provider: 'email', providerAccountId: email, providerEmail: email },
    });
  }

  const { sessionToken, expiresAt } = await createSession(user.id);
  return { ok: true, message: '登录成功！', userId: user.id, sessionToken, expiresAt };
}

async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    console.warn('[email-otp] SMTP_HOST 未配置，跳过邮件发送。');
    return false; // Phase 1 加固：不打印验证码；未配 SMTP 视为发送失败
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost, port: Number(process.env.SMTP_PORT || 587), secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@aifanyi.com', to, subject: '爱翻译 AI翻译 · 邮箱验证码',
      text: `您的验证码是：${otp}，10 分钟内有效。请勿将验证码告知他人。`,
      html: `<p>您的验证码是：<strong style="font-size:24px">${otp}</strong></p><p>10 分钟内有效。请勿将验证码告知他人。</p><p>— 爱翻译 aifanyi.com</p>`,
    });
    return true;
  } catch (e: any) { console.error('[email-otp] send failed:', e?.message); return false; }
}
