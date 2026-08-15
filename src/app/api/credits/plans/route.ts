/**
 * GET /api/credits/plans
 * 积分充值套餐列表（3 SKU，active 生效）
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const plans = await prisma.pricePlan.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json({
    ok: true,
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      priceCents: p.priceCents,
      totalCredits: p.totalCredits,
      purchasedCredits: p.purchasedCredits,
      bonusCredits: p.bonusCredits,
      badge: p.badge,
      description: p.description,
    })),
  });
}
