import { prisma } from '../db';
import { createSession } from './session';
import { GoogleTokenResponse, GoogleIdToken } from './types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code', scope: 'openid email profile',
    access_type: 'online', prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * 用 Google tokeninfo 端点验证 id_token（零依赖，server-side）。
 * 校验：token 有效性（Google 端点校验签名/过期）、aud、iss、email_verified。
 */
export async function verifyIdToken(idToken: string): Promise<GoogleIdToken> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error('Google id_token 验证失败');

  const info: Record<string, string> = await res.json();
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (info.aud !== expectedAud) throw new Error('Google id_token audience 不匹配');
  if (info.iss !== 'https://accounts.google.com' && info.iss !== 'accounts.google.com') {
    throw new Error('Google id_token issuer 不匹配');
  }
  if (info.email_verified !== 'true') throw new Error('Google 账户邮箱未验证');
  if (!info.sub || !info.email) throw new Error('Google id_token 缺少身份字段');

  return {
    iss: 'https://accounts.google.com',
    sub: info.sub,
    email: info.email,
    email_verified: true,
    name: info.name,
    picture: info.picture,
  };
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ userId: string; sessionToken: string; expiresAt: Date }> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);

  const token: GoogleTokenResponse = await tokenRes.json();
  if (!token.id_token) throw new Error('Google token 交换缺少 id_token');
  const profile = await verifyIdToken(token.id_token);

  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    user = await prisma.user.create({ data: { email: profile.email, emailVerified: new Date(), nickname: profile.name || profile.email.split('@')[0], avatar: profile.picture, authProvider: 'google', status: 'active', lastLoginAt: new Date() } });
  } else {
    const patch: Record<string, unknown> = { lastLoginAt: new Date(), emailVerified: new Date() };
    if (!user.avatar && profile.picture) patch.avatar = profile.picture;
    if (!user.nickname && profile.name) patch.nickname = profile.name;
    if (!user.authProvider) patch.authProvider = 'google';
    await prisma.user.update({ where: { id: user.id }, data: patch });
    if (user.status === 'deleted') throw new Error('账户已注销，无法登录。');
  }

  const session = await createSession(user.id);
  return { userId: user.id, ...session };
}
