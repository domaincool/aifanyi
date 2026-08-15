/**
 * POST /api/credits/confirm
 * 模拟支付确认入口（仅 mock provider）：订单 → paid → grant → granted
 * 真实渠道（lemonsqueezy / paddle）不走此接口，由 Webhook 触发到账
 * 幂等：grantRechargeOrder 内部用 recharge:{orderId}:{purchased|bonus} 幂等键
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';
import { getPaymentProvider } from '@/lib/payment';
import { grantRechargeOrder } from '@/lib/payment/grant';

export async function POST(req: Request) {
  const provider = getPaymentProvider();
  if (provider.code !== 'mock') {
    return NextResponse.json({ ok: false, code: 'not_supported', error: '当前支付渠道不支持模拟确认。' }, { status: 400 });
  }

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

  const result = await grantRechargeOrder(order.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: 'grant_error', error: '积分到账异常，请稍后重试（不会重复扣款）。' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, granted: result.granted });
}
