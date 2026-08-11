import { NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  const token = await getSessionCookie();
  if (!token) {
    return NextResponse.json({ user: null });
  }
  const user = await validateSession(token);
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.userId,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      authProvider: user.authProvider,
    },
  });
}