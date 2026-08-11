import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/auth/logout-all
 * 退出所有设备（可传 exceptCurrent=true 保留当前会话）
 */
export async function POST(req: NextRequest) {
  const token = await getSessionCookie();
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const user = await validateSession(token);
  if (!user) return NextResponse.json({ error: '会话已过期' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const exceptCurrent = body.exceptCurrent === true;

  if (exceptCurrent) {
    // 撤销除当前外的所有 session
    await prisma.session.updateMany({
      where: { userId: user.userId, sessionToken: { not: token }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } else {
    // 撤销全部（包括当前，前端随后清 cookie）
    await prisma.session.updateMany({
      where: { userId: user.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const res = NextResponse.json({ ok: true, currentRevoked: !exceptCurrent });
  if (!exceptCurrent) {
    res.cookies.set('aifanyi_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  }
  return res;
}
