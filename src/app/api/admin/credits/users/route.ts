/**
 * GET /api/admin/credits/users — 用户额度列表（admin）
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/credit/admin-auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { status: 'active' },
    select: { id: true, email: true, nickname: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const accounts = await prisma.creditAccount.findMany({ select: { userId: true, balance: true, reservedBalance: true } });
  const accMap = new Map(accounts.map(a => [a.userId, a]));

  const rows = users.map(u => {
    const acc = accMap.get(u.id);
    return {
      id: u.id,
      email: u.email || '(无邮箱)',
      nickname: u.nickname || '',
      available: acc?.balance ?? 0,
      reserved: acc?.reservedBalance ?? 0,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ admin: admin.email, users: rows, total: rows.length });
}
