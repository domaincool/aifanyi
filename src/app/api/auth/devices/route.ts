import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

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

  // 找到该 session 并确认属于当前用户
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
