/**
 * 充值到账共享逻辑：订单已支付 → grant 本金 PURCHASED（长期）+ 赠送 BONUS（30 天）→ granted
 * mock confirm 与真实渠道 webhook 共用（幂等：grant 用 recharge:{orderId}:{purchased|bonus}）
 *
 * 竞态安全（对抗审查 P1-1 修复）：
 *   全程单事务 + SELECT FOR UPDATE 锁订单行 + 事务内复查状态。
 *   与 refund clawback（webhook route 的 clawbackRechargeRefund）锁同一订单行 → 互斥：
 *     · grant 先提交 → clawback 事务内重读看到 granted + 全部 grants → 正确扣回
 *     · clawback 先提交（订单标 refunded）→ 本事务内复查 status=refunded → 拒绝到账
 *   杜绝「退款已处理但积分仍全额到账且永不扣回」的资金竞态。
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { GRANT_TYPES, LEDGER_TYPES } from '@/lib/credit/types';

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

const IDEMPOTENT_ERROR = 'P2002';

interface TxGrantInput {
  userId: string;
  type: string;
  source: string;
  amount: number;
  expiresAt?: Date | null;
  idempotencyKey: string;
}

/** 事务内 grant（等效 engine.grantCredits：幂等键 + 账户行锁 + Grant 记录 + Ledger），与主事务同提交/同回滚 */
async function txGrant(tx: Prisma.TransactionClient, input: TxGrantInput): Promise<{ ok: boolean; idempotent?: boolean }> {
  const found = await tx.creditLedger.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });
  if (found) return { ok: true, idempotent: true };

  const rows: any[] = await tx.$queryRaw`SELECT id, balance, "reservedBalance" FROM "CreditAccount" WHERE "userId" = ${input.userId} FOR UPDATE`;
  const acc = rows[0];
  if (!acc) {
    await tx.creditAccount.create({ data: { userId: input.userId, balance: input.amount, reservedBalance: 0 } });
  } else {
    await tx.creditAccount.update({
      where: { id: acc.id },
      data: { balance: { increment: input.amount }, version: { increment: 1 } },
    });
  }

  const grant = await tx.creditGrant.create({
    data: {
      userId: input.userId,
      type: input.type,
      source: input.source,
      totalAmount: input.amount,
      remainingAmount: input.amount,
      reservedAmount: 0,
      expiresAt: input.expiresAt ?? null,
    },
  });

  await tx.creditLedger.create({
    data: {
      userId: input.userId,
      type: LEDGER_TYPES.GRANT,
      amount: input.amount,
      grantId: grant.id,
      idempotencyKey: input.idempotencyKey,
      description: `${input.source} +${input.amount}`,
    },
  });

  return { ok: true };
}

export async function grantRechargeOrder(orderId: string, opts?: GrantRechargeOrderOptions): Promise<GrantResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1) 锁订单行（refund clawback 同锁 → 到账/退款互斥）
      const rows: any[] = await tx.$queryRaw`SELECT * FROM "RechargeOrder" WHERE id = ${orderId} FOR UPDATE`;
      const order = rows[0];
      if (!order) return { ok: false as const, error: 'not_found' as const };

      // 2) 事务内复查状态（clawback 先处理时这里看到 refunded → 拒绝到账）
      if (order.status === 'granted') {
        return { ok: true as const, already: true as const, granted: { purchased: order.purchasedCredits, bonus: order.bonusCredits } };
      }
      // cancelled 永不到账（已取消/退款）；refunded 退款后永不到账；expired 仅 webhook（钱已收）可到账
      if (order.status === 'cancelled' || order.status === 'refunded') {
        return { ok: false as const, error: 'invalid_state' as const };
      }
      if (order.status === 'expired' && !opts?.allowExpired) {
        return { ok: false as const, error: 'invalid_state' as const };
      }
      // 渠道订单号校验：订单已有 providerOrderId 且与 webhook 不一致 → 拒绝（防跨单到账）
      if (opts?.expectedProviderOrderId && order.providerOrderId && opts.expectedProviderOrderId !== order.providerOrderId) {
        return { ok: false as const, error: 'provider_order_mismatch' as const };
      }

      // 3) 标 paid（幂等；事务内，回滚即还原）
      if (order.status !== 'paid') {
        await tx.rechargeOrder.update({ where: { id: order.id }, data: { status: 'paid', paidAt: new Date() } });
      }

      // 4) grant 本金 PURCHASED（长期有效）
      if (order.purchasedCredits > 0) {
        const r = await txGrant(tx, {
          userId: order.userId,
          type: GRANT_TYPES.PURCHASED,
          source: `购买 ${order.planName}`,
          amount: order.purchasedCredits,
          idempotencyKey: `recharge:${order.id}:purchased`,
        });
        if (!r.ok) return { ok: false as const, error: 'grant_error' as const };
      }

      // 5) grant 赠送 BONUS（30 天）
      if (order.bonusCredits > 0) {
        const plan = await tx.pricePlan.findUnique({ where: { code: order.planCode } });
        const ttlDays = plan?.bonusTtlDays ?? 30;
        const r = await txGrant(tx, {
          userId: order.userId,
          type: GRANT_TYPES.BONUS,
          source: `${order.planName} 赠送`,
          amount: order.bonusCredits,
          expiresAt: new Date(Date.now() + ttlDays * 86400_000),
          idempotencyKey: `recharge:${order.id}:bonus`,
        });
        if (!r.ok) return { ok: false as const, error: 'grant_error' as const };
      }

      // 6) 标记 granted（事务内，与到账原子）
      await tx.rechargeOrder.update({ where: { id: order.id }, data: { status: 'granted', grantedAt: new Date() } });

      return { ok: true as const, granted: { purchased: order.purchasedCredits, bonus: order.bonusCredits } };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, already: true, granted: { purchased: 0, bonus: 0 } };
    throw e;
  }
}
