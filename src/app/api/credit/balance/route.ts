/**
 * GET /api/credit/balance
 * 登录：返回可用/预留/来源/本月已用；未登录：返回游客引导文案（登录送 500）
 * 注册赠送懒触发：首次访问额度时发放（幂等 signup_bonus:{userId}）
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';
import { grantCredits } from '@/lib/credit/engine';
import { GRANT_TYPES } from '@/lib/credit/types';

const SIGNUP_BONUS = 500;
const SIGNUP_TTL_DAYS = 30;

export async function GET() {
  const auth = await getAuthUserId();
  if (!auth) {
    return NextResponse.json({
      loggedIn: false,
      signupBonus: SIGNUP_BONUS,
      message: '登录后即可获得免费额度',
    });
  }
  const userId = auth.userId;

  // 注册赠送懒触发（幂等）
  const existing = await prisma.creditGrant.findFirst({
    where: { userId, type: GRANT_TYPES.FREE_GRANT, source: '注册赠送' },
  });
  if (!existing) {
    await grantCredits({
      userId,
      type: GRANT_TYPES.FREE_GRANT,
      source: '注册赠送',
      amount: SIGNUP_BONUS,
      expiresAt: new Date(Date.now() + SIGNUP_TTL_DAYS * 86400_000),
      idempotencyKey: `signup_bonus:${userId}`,
    }).catch((e: any) => console.error('[credit/balance] signup grant:', e?.message));
  }

  const acc = await prisma.creditAccount.findUnique({ where: { userId } });
  const grants = await prisma.creditGrant.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, source: true, totalAmount: true, remainingAmount: true, expiresAt: true, createdAt: true },
    take: 10,
  });

  // 本月已用（consumed 记录）
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthAgg = await prisma.usageRecord.aggregate({
    where: { userId, status: 'consumed', completedAt: { gte: monthStart } },
    _sum: { consumedCredits: true },
  });
  const monthUsed = monthAgg._sum.consumedCredits || 0;

  // 最近到期日
  const expiring = grants.filter(g => g.expiresAt && g.remainingAmount > 0).sort((a, b) => (a.expiresAt!.getTime() - b.expiresAt!.getTime()))[0];

  return NextResponse.json({
    loggedIn: true,
    available: acc?.balance ?? 0,
    reserved: acc?.reservedBalance ?? 0,
    monthUsed,
    grants: grants.map(g => ({
      source: g.source,
      total: g.totalAmount,
      remaining: g.remainingAmount,
      expiresAt: g.expiresAt,
    })),
    expiringAt: expiring?.expiresAt ?? null,
  });
}
