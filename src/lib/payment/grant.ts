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

export interface GrantRechargeOrderOptions {
  /** webhook 场景传 true：钱已收到，即使我方订单已标 expired 也要到账（渠道 checkout 有效期可能长于我方 15 分钟） */
  allowExpired?: boolean;
  /** 渠道侧订单号（checkout id）：与订单落库的 providerOrderId 不一致时拒绝，防 metadata 配错跨单到账 */
  expectedProviderOrderId?: string;
}

export async function grantRechargeOrder(orderId: string, opts?: GrantRechargeOrderOptions): Promise<GrantResult> {
  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: 'not_found' };
  if (order.status === 'granted') {
    return { ok: true, already: true, granted: { purchased: order.purchasedCredits, bonus: order.bonusCredits } };
  }
  // cancelled 永不到账（已取消/退款）；expired 仅 webhook（钱已收）可到账，confirm 场景保持拒绝
  if (order.status === 'cancelled') {
    return { ok: false, error: 'invalid_state' };
  }
  if (order.status === 'expired' && !opts?.allowExpired) {
    return { ok: false, error: 'invalid_state' };
  }
  // 渠道订单号校验：订单已有 providerOrderId 且与 webhook 不一致 → 拒绝（防跨单到账）
  if (opts?.expectedProviderOrderId && order.providerOrderId && opts.expectedProviderOrderId !== order.providerOrderId) {
    return { ok: false, error: 'provider_order_mismatch' };
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
