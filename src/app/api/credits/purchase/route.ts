/**
 * POST /api/credits/purchase
 * 创建积分充值订单（登录态）
 * 渠道抽象：mock（前端 confirm）→ lemonsqueezy / paddle（前端跳 checkout URL）
 * 同用户同套餐 15 分钟内未支付订单复用（防重复下单）
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';
import { getPaymentProvider } from '@/lib/payment';

const PLAN_SUMMARY = (plan: any) => ({
  code: plan.code,
  name: plan.name,
  priceCents: plan.priceCents,
  totalCredits: plan.totalCredits,
  bonusCredits: plan.bonusCredits,
});

export async function POST(req: Request) {
  const auth = await getAuthUserId();
  if (!auth) {
    return NextResponse.json({ ok: false, code: 'auth_required', error: '请先登录后再购买积分。' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  const email = user?.email || '';

  const body = await req.json().catch(() => ({}));
  const planCode = typeof body.planCode === 'string' ? body.planCode : '';
  if (!planCode) {
    return NextResponse.json({ ok: false, code: 'bad_request', error: '缺少 planCode。' }, { status: 400 });
  }

  const plan = await prisma.pricePlan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active) {
    return NextResponse.json({ ok: false, code: 'not_found', error: '套餐不存在或已下架。' }, { status: 404 });
  }

  const provider = getPaymentProvider();

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
      mock: provider.code === 'mock',
      provider: provider.code,
      checkoutUrl: provider.code === 'mock' ? '' : (existing.checkoutUrl || ''),
      plan: PLAN_SUMMARY(plan),
      message: provider.code === 'mock' ? '当前为模拟支付模式，点击确认即完成支付。' : '请继续完成支付。',
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
      provider: provider.code,
      idempotencyKey: `recharge:${randomUUID()}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // 创建支付会话（真实渠道返回 checkout URL）
  let checkoutUrl = '';
  try {
    const result = await provider.createCheckout({
      orderId: order.id,
      planCode: plan.code,
      planName: plan.name,
      priceCents: plan.priceCents,
      purchasedCredits: plan.purchasedCredits,
      bonusCredits: plan.bonusCredits,
      userId: auth.userId,
      email,
    });
    checkoutUrl = result.checkoutUrl || '';
    const patch: any = {};
    if (result.providerOrderId) patch.providerOrderId = result.providerOrderId;
    if (checkoutUrl) patch.checkoutUrl = checkoutUrl;
    if (Object.keys(patch).length) {
      await prisma.rechargeOrder.update({ where: { id: order.id }, data: patch });
    }
  } catch (e: any) {
    await prisma.rechargeOrder.delete({ where: { id: order.id } }).catch(() => {});
    return NextResponse.json({ ok: false, code: 'payment_error', error: e?.message || '支付渠道暂不可用，请稍后重试。' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    status: order.status,
    mock: provider.code === 'mock',
    provider: provider.code,
    checkoutUrl,
    plan: PLAN_SUMMARY(plan),
    message: provider.code === 'mock' ? '当前为模拟支付模式，点击确认即完成支付。' : '请在新窗口完成支付，支付成功后积分自动到账。',
  });
}
