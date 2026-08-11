import { prisma } from '../db';
import { createSession } from './session';
import { GoogleTokenResponse, GoogleIdToken } from './types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function getGoogleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code', scope: 'openid email profile',
    access_type: 'online', prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ userId: string; sessionToken: string; expiresAt: Date }> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);

  const token: GoogleTokenResponse = await tokenRes.json();
  const payloadBase64 = token.id_token.split('.')[1];
  const profile: GoogleIdToken = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
  if (!profile.email_verified) throw new Error('Google 账户邮箱未验证');

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