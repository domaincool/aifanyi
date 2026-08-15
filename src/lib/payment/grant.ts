/**
 * 充值到账共享逻辑：订单已支付 → grant 本金 PURCHASED（长期）+ 赠送 BONUS（30 天）→ granted
 * mock confirm 与真实渠道 webhook 共用（幂等：grant 用 recharge:{orderId}:{purchased|bonus}）
 */
import { prisma } from '@/lib/db';
import { grantCredits } from '@/lib/credit/engine';
import { GRANT_TYPES } from '@/lib/credit/types';

export interface GrantResult {
  ok: boolean;
  already?: boolean;
  granted?: { purchased: number; bonus: number };
  error?: string;
}

export async function grantRechargeOrder(orderId: string): Promise<GrantResult> {
  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: 'not_found' };
  if (order.status === 'granted') {
    return { ok: true, already: true, granted: { purchased: order.purchasedCredits, bonus: order.bonusCredits } };
  }
  // 仅 pending / paid 可到账；expired / cancelled 不可
  if (order.status !== 'pending' && order.status !== 'paid') {
    return { ok: false, error: 'invalid_state' };
  }

  // 1) 标记 paid（幂等）
  if (order.status !== 'paid') {
    await prisma.rechargeOrder.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date() },
    });
  }

  // 2) grant 本金 PURCHASED（长期有效）
  let purchasedOk = true;
  if (order.purchasedCredits > 0) {
    const r = await grantCredits({
      userId: order.userId,
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
      userId: order.userId,
      type: GRANT_TYPES.BONUS,
      source: `${order.planName} 赠送`,
      amount: order.bonusCredits,
      expiresAt: new Date(Date.now() + ttlDays * 86400_000),
      idempotencyKey: `recharge:${order.id}:bonus`,
    });
    bonusOk = r.ok;
  }

  if (!purchasedOk || !bonusOk) {
    return { ok: false, error: 'grant_error' };
  }

  // 4) 标记 granted
  await prisma.rechargeOrder.update({
    where: { id: order.id },
    data: { status: 'granted', grantedAt: new Date() },
  });

  return { ok: true, granted: { purchased: order.purchasedCredits, bonus: order.bonusCredits } };
}
