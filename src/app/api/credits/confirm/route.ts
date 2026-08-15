/**
 * POST /api/credits/confirm
 * 模拟支付确认：订单 paid → grant（PURCHASED 本金长期有效 + BONUS 赠送 30 天）→ granted
 * 幂等：grant 用 recharge:{orderId}:purchased / recharge:{orderId}:bonus，重复确认安全
 * 真实支付接入后，此流程由支付回调 Webhook 触发
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';
import { grantCredits } from '@/lib/credit/engine';
import { GRANT_TYPES } from '@/lib/credit/types';

export async function POST(req: Request) {
  const auth = await getAuthUserId();
  if (!auth) {
    return NextResponse.json({ ok: false, code: 'auth_required', error: '请先登录。' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  if (!orderId) {
    return NextResponse.json({ ok: false, code: 'bad_request', error: '缺少 orderId。' }, { status: 400 });
  }

  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== auth.userId) {
    return NextResponse.json({ ok: false, code: 'not_found', error: '订单不存在。' }, { status: 404 });
  }
  if (order.status === 'granted') {
    return NextResponse.json({ ok: true, granted: { purchased: order.purchasedCredits, bonus: order.bonusCredits }, already: true });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ ok: false, code: 'invalid_state', error: '订单状态不可确认。' }, { status: 400 });
  }
  if (order.expiresAt && order.expiresAt < new Date()) {
    await prisma.rechargeOrder.update({ where: { id: order.id }, data: { status: 'expired' } });
    return NextResponse.json({ ok: false, code: 'expired', error: '订单已过期，请重新下单。' }, { status: 400 });
  }

  // 1) 标记 paid（幂等）
  await prisma.rechargeOrder.update({
    where: { id: order.id },
    data: { status: 'paid', paidAt: new Date(), providerOrderId: `mock_${order.id}` },
  });

  // 2) grant 本金 PURCHASED（长期有效）
  let purchasedOk = true;
  if (order.purchasedCredits > 0) {
    const r = await grantCredits({
      userId: auth.userId,
      type: GRANT_TYPES.PURCHASED,
      source: `购买 ${order.planName}`,
      amount: order.purchasedCredits,
      idempotencyKey: `recharge:${order.id}:purchased`,
    });
    purchasedOk = r.ok;
  }

  // 3) grant 赠送 BONUS（30 天）
  let bonusOk = true;
  if (order.bonusCredits > 0) {
    const plan = await prisma.pricePlan.findUnique({ where: { code: order.planCode } });
    const ttlDays = plan?.bonusTtlDays ?? 30;
    const r = await grantCredits({
      userId: auth.userId,
      type: GRANT_TYPES.BONUS,
      source: `${order.planName} 赠送`,
      amount: order.bonusCredits,
      expiresAt: new Date(Date.now() + ttlDays * 86400_000),
      idempotencyKey: `recharge:${order.id}:bonus`,
    });
    bonusOk = r.ok;
  }

  if (!purchasedOk || !bonusOk) {
    return NextResponse.json({ ok: false, code: 'grant_error', error: '积分到账异常，请稍后重试（不会重复扣款）。' }, { status: 500 });
  }

  // 4) 标记 granted
  await prisma.rechargeOrder.update({
    where: { id: order.id },
    data: { status: 'granted', grantedAt: new Date() },
  });

  return NextResponse.json({ ok: true, granted: { purchased: order.purchasedCredits, bonus: order.bonusCredits } });
}
