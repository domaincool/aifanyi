/**
 * POST /api/credits/purchase
 * 创建积分充值订单（登录态）
 * 当前为模拟支付模式（provider=mock，支付渠道待收款主体确认后接入）
 * 同用户同套餐 15 分钟内未支付订单复用（防重复下单）
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';

export async function POST(req: Request) {
  const auth = await getAuthUserId();
  if (!auth) {
    return NextResponse.json({ ok: false, code: 'auth_required', error: '请先登录后再购买积分。' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const planCode = typeof body.planCode === 'string' ? body.planCode : '';
  if (!planCode) {
    return NextResponse.json({ ok: false, code: 'bad_request', error: '缺少 planCode。' }, { status: 400 });
  }

  const plan = await prisma.pricePlan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active) {
    return NextResponse.json({ ok: false, code: 'not_found', error: '套餐不存在或已下架。' }, { status: 404 });
  }

  // 复用 15 分钟内未支付订单
  const existing = await prisma.rechargeOrder.findFirst({
    where: {
      userId: auth.userId,
      planCode: plan.code,
      status: 'pending',
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      orderId: existing.id,
      status: existing.status,
      mock: true,
      plan: { code: plan.code, name: plan.name, priceCents: plan.priceCents, totalCredits: plan.totalCredits, bonusCredits: plan.bonusCredits },
      message: '当前为模拟支付模式，点击确认即完成支付（支付渠道待接入）。',
    });
  }

  const order = await prisma.rechargeOrder.create({
    data: {
      userId: auth.userId,
      planCode: plan.code,
      planName: plan.name,
      priceCents: plan.priceCents,
      purchasedCredits: plan.purchasedCredits,
      bonusCredits: plan.bonusCredits,
      status: 'pending',
      provider: 'mock',
      idempotencyKey: `recharge:${randomUUID()}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    status: order.status,
    mock: true,
    plan: { code: plan.code, name: plan.name, priceCents: plan.priceCents, totalCredits: plan.totalCredits, bonusCredits: plan.bonusCredits },
    message: '当前为模拟支付模式，点击确认即完成支付（支付渠道待接入）。',
  });
}
