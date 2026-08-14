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
    select: { id: true, email: true, nickname: true, authProvider: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const [accounts, sessions, usages] = await Promise.all([
    prisma.creditAccount.findMany({ select: { userId: true, balance: true, reservedBalance: true } }),
    prisma.session.groupBy({ by: ['userId'], _max: { lastUsedAt: true } }),
    prisma.usageRecord.groupBy({ by: ['userId'], _count: { _all: true } }),
  ]);
  const accMap = new Map(accounts.map(a => [a.userId, a]));
  const sessMap = new Map(sessions.map(s => [s.userId, s._max.lastUsedAt]));
  const usageMap = new Map(usages.map(u => [u.userId, u._count._all]));

  const rows = users.map(u => {
    const acc = accMap.get(u.id);
    return {
      id: u.id,
      email: u.email || '(无邮箱)',
      nickname: u.nickname || '',
      authProvider: u.authProvider || '',
      lastActive: sessMap.get(u.id) || u.lastLoginAt || null,
      usageCount: usageMap.get(u.id) ?? 0,
      available: acc?.balance ?? 0,
      reserved: acc?.reservedBalance ?? 0,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ admin: admin.email, users: rows, total: rows.length });
}
