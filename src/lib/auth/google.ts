/**
 * Google OAuth2 流程
 * 1. GET /api/auth/google → 302 Google 授权页
 * 2. GET /api/auth/google/callback → code exchange → upsert User → 发 session cookie
 */
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '../db';
import { createSession } from './session';
import { setSessionCookie } from './cookie';
import { GoogleTokenResponse, GoogleIdToken } from './types';

const encoder = new TextEncoder();
function getSecret() { return encoder.encode(process.env.JWT_SECRET!); }

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function getClientId() {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error('GOOGLE_CLIENT_ID 环境变量未设置');
  return id;
}
function getClientSecret() {
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (!s) throw new Error('GOOGLE_CLIENT_SECRET 环境变量未设置');
  return s;
}

export function getGoogleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<string> {
  // 1. code → access_token + id_token
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${err.slice(0, 200)}`);
  }
  const token: GoogleTokenResponse = await tokenRes.json();

  // 2. 解码 id_token（不调 userinfo endpoint，id_token 自带 email/name/picture）
  const payloadBase64 = token.id_token.split('.')[1];
  const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
  const profile: GoogleIdToken = JSON.parse(payloadJson);

  if (!profile.email_verified) {
    throw new Error('Google 账户邮箱未验证，请先验证 Google 邮箱后重试。');
  }

  // 3. upsert User
  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        emailVerified: new Date(),
        nickname: profile.name || profile.email.split('@')[0],
        avatar: profile.picture,
        authProvider: 'google',
        status: 'active',
        lastLoginAt: new Date(),
      },
    });
  } else {
    // 更新登录信息（如果之前是 email OTP 注册的，补充 Google 信息）
    const patch: Record<string, unknown> = { lastLoginAt: new Date(), emailVerified: new Date() };
    if (!user.avatar && profile.picture) patch.avatar = profile.picture;
    if (!user.nickname && profile.name) patch.nickname = profile.name;
    if (!user.authProvider) patch.authProvider = 'google';
    await prisma.user.update({ where: { id: user.id }, data: patch });
  }

  if (user.status === 'deleted') {
    throw new Error('账户已注销，无法登录。如需恢复请联系我们。');
  }

  // 4. 创建 session
  const { sessionToken, expiresAt } = await createSession(user.id);
  await setSessionCookie(sessionToken, expiresAt);

  return user.id;
}