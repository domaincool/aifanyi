import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getGuestCookie } from '@/lib/auth/cookie';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [todayUsage, monthUsage, history] = await Promise.all([
    prisma.usageLedger.aggregate({
      where: { userId: auth.user.userId, createdAt: { gte: todayStart }, type: 'pdf_translation' },
      _sum: { amount: true },
    }),
    prisma.usageLedger.aggregate({
      where: { userId: auth.user.userId, createdAt: { gte: monthStart }, type: 'pdf_translation' },
      _sum: { amount: true },
    }),
    prisma.usageLedger.findMany({
      where: { userId: auth.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { type: true, amount: true, unit: true, description: true, createdAt: true },
    }),
  ]);

  const dailyLimit = 50; // 配置化
  const usedToday = todayUsage._sum.amount || 0;

  return NextResponse.json({
    today: { used: usedToday, limit: dailyLimit, remaining: Math.max(0, dailyLimit - usedToday), resetAt: '明天 00:00（Asia/Shanghai）' },
    month: { totalUsed: monthUsage._sum.amount || 0 },
    history,
  });
}