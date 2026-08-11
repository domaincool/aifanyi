import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/auth/devices
 * 列出当前用户的所有登录设备（Session 记录），含当前 session 标记
 */
export async function GET(req: NextRequest) {
  const token = await getSessionCookie();
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const user = await validateSession(token);
  if (!user) return NextResponse.json({ error: '会话已过期' }, { status: 401 });

  const sessions = await prisma.session.findMany({
    where: { userId: user.userId, revokedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      sessionToken: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      ipHash: true,
      userAgentHash: true,
    },
  });

  return NextResponse.json({
    devices: sessions.map(s => ({
      id: s.id,
      sessionToken: s.sessionToken,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      ipHash: s.ipHash,
      userAgentHash: s.userAgentHash,
      current: s.sessionToken === token,
    })),
  });
}

/**
 * DELETE /api/auth/devices
 * 退出指定设备（撤销该 Session；不允许撤销当前设备）
 * body: { deviceId: string }
 */
export async function DELETE(req: NextRequest) {
  const token = await getSessionCookie();
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const user = await validateSession(token);
  if (!user) return NextResponse.json({ error: '会话已过期' }, { status: 401 });

  const { deviceId } = await req.json().catch(() => ({}));
  if (!deviceId) return NextResponse.json({ error: '缺少 deviceId' }, { status: 400 });

  const target = await prisma.session.findUnique({ where: { id: deviceId } });
  if (!target || target.userId !== user.userId) {
    return NextResponse.json({ error: '设备不存在' }, { status: 404 });
  }
  if (target.sessionToken === token) {
    return NextResponse.json({ error: '不能退出当前设备' }, { status: 400 });
  }

  await prisma.session.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
