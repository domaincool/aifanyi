/**
 * POST /api/credits/webhook/[provider]
 * 真实渠道支付回调：验签 → 事件分派
 *   checkout.completed → grantRechargeOrder（幂等到账；allowExpired + expectedProviderOrderId 校验；grant 写 CreditLedger 审计）
 *   refund.created    → clawbackRechargeRefund（幂等扣回未消耗额度；余额不足部分扣回不做负余额；CreditLedger REFUND 负值审计）
 *   mock 模式无此回调（由 /api/credits/confirm 代替）
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getPaymentProvider, WebhookVerifyResult } from '@/lib/payment';
import { grantRechargeOrder } from '@/lib/payment/grant';
import { LEDGER_TYPES } from '@/lib/credit/types';

/** refund.created 事件扩展字段（与 creem.ts 的 CreemWebhookVerifyResult 对应；route 侧不强依赖渠道实现文件） */
type RefundWebhookInfo = WebhookVerifyResult & {
  refundId?: string;
  refundCurrency?: string;
  refundReason?: string;
  checkoutId?: string;
};

/** 退款扣回结果 */
interface ClawbackResult {
  ok: boolean;
  already?: boolean;
  clawed?: number;
  error?: string;
}

function buildRefundMetadata(
  order: { id: string; userId: string },
  info: RefundWebhookInfo,
  targetRemaining: number,
  clawed: number,
): Record<string, unknown> {
  return {
    source: 'creem_refund',
    orderId: order.id,
    refundId: info.refundId ?? null,
    checkoutId: info.checkoutId ?? null,
    refundAmountCents: info.amountCents ?? null,
    refundCurrency: info.refundCurrency ?? null,
    refundReason: info.refundReason ?? null,
    targetRemaining,
    clawed,
    partialClawback: clawed > 0 && clawed < targetRemaining,
  };
}

/**
 * 支付退款 → 扣回未消耗额度（拍板默认值：未消耗全额退 + 已消耗按剩余比例退 + 余额不足部分扣回，不做负余额）
 * 幂等：CreditLedger.idempotencyKey = `recharge:{orderId}:refund:{refundId}`（refundId 唯一；无 refundId 回退 'once'；
 *       唯一约束兜底，重复投递/同单多次退款各自独立扣回，不再被固定键静默吞掉 —— 对抗审查 P1-2 修复）
 * 竞态：事务内 SELECT FOR UPDATE 锁订单行 + 锁账户行，与 grantRechargeOrder 互斥（P1-1 修复）：
 *       到账事务未提交时本事务等待；提交后事务内重读 status + grants → 扣回目标一致，杜绝「退款已处理仍全额到账」
 * 审计：写 CreditLedger（type=refund，amount=-扣回，referenceId=渠道退款单，description/metadata 记录 refund 来源）
 * 注：engine.refund 语义为「系统错误补偿发回」（+余额，append-only），与支付退款扣回方向相反，此处不复用；差异见 README
 */
async function clawbackRechargeRefund(orderId: string, info: RefundWebhookInfo): Promise<ClawbackResult> {
  const idempotencyKey = `recharge:${orderId}:refund:${info.refundId || 'once'}`;
  const IDEMPOTENT_ERROR = 'P2002';

  try {
    return await prisma.$transaction(async (tx) => {
      // 幂等（事务内查，与 engine 同模式）
      const found = await tx.creditLedger.findUnique({ where: { idempotencyKey }, select: { id: true } });
      if (found) return { ok: true as const, already: true as const, clawed: 0 as const };

      // 锁订单行（与 grantRechargeOrder 互斥 → 事务内状态与 grants 一致，杜绝「退款 vs 到账」竞态）
      const orderRows: any[] = await tx.$queryRaw`SELECT * FROM "RechargeOrder" WHERE id = ${orderId} FOR UPDATE`;
      const order = orderRows[0];
      if (!order) {
        // 我方从未建单 → 从未到账，无可扣回（正常确认即可，防 Creem 无限重试）
        return { ok: true as const, already: true as const, clawed: 0 as const };
      }
      if (order.status === 'refunded') {
        // 已处理过（幂等；Creem 至少一次投递）
        return { ok: true as const, already: true as const, clawed: 0 as const };
      }
      // 渠道订单号校验：退款指向的 checkout 必须与落库一致（防 metadata 配错跨单扣回）
      if (info.checkoutId && order.providerOrderId && info.checkoutId !== order.providerOrderId) {
        return { ok: false as const, error: 'provider_order_mismatch' as const };
      }

      // 未到账（pending/expired/cancelled）：无可扣回；标记 refunded，杜绝后续 checkout.completed 补单到账
      if (order.status !== 'granted' && order.status !== 'paid') {
        await tx.rechargeOrder.update({ where: { id: order.id }, data: { status: 'refunded' } });
        return { ok: true as const, already: false as const, clawed: 0 as const };
      }

      // 事务内定位本单 grants：经 grant 落库的 Ledger 幂等键反查 grantId（grant 事务已提交/已回滚 → 数据一致）
      const ledgers = await tx.creditLedger.findMany({
        where: { idempotencyKey: { in: [`recharge:${order.id}:purchased`, `recharge:${order.id}:bonus`] } },
        select: { grantId: true },
      });
      const grantIds = ledgers.map((l) => l.grantId).filter(Boolean) as string[];
      const grants = grantIds.length
        ? await tx.creditGrant.findMany({
            where: { id: { in: grantIds } },
            select: { id: true, remainingAmount: true, reservedAmount: true },
          })
        : [];
      // 扣回目标 = 未消耗且未预留部分（reserved 不动，避免破坏在途任务结算）
      const target = grants.reduce((s, g) => s + Math.max(0, g.remainingAmount - (g.reservedAmount ?? 0)), 0);

      // 行锁账户（余额操作在锁内完成，杜绝超卖/负余额）
      const accRows: any[] = await tx.$queryRaw`SELECT id, balance, "reservedBalance" FROM "CreditAccount" WHERE "userId" = ${order.userId} FOR UPDATE`;
      const acc = accRows[0];
      // 余额不足部分扣回，不做负余额
      const clawed = target > 0 && acc ? Math.min(target, acc.balance) : 0;

      if (clawed <= 0) {
        // 已全部消耗或可用余额为 0：无可扣回，仅标记 + 审计（amount 0 不影响对账不变量）
        await tx.rechargeOrder.update({ where: { id: order.id }, data: { status: 'refunded' } });
        await tx.creditLedger.create({
          data: {
            userId: order.userId,
            type: LEDGER_TYPES.REFUND,
            amount: 0,
            referenceId: info.refundId ?? undefined,
            idempotencyKey,
            description: `支付退款（${info.refundReason || '无原因'}）：无可扣回（未消耗剩余 ${target}，可用 0）`,
            metadata: buildRefundMetadata(order, info, target, 0) as unknown as Prisma.InputJsonObject,
          },
        });
        return { ok: true as const, already: false as const, clawed: 0 as const };
      }

      await tx.creditAccount.update({
        where: { id: acc.id },
        data: { balance: { decrement: clawed }, version: { increment: 1 } },
      });

      // 摊扣本单 grants（与账户余额保持同步；不变量：available == Σ(remaining - reserved)）
      let remaining = clawed;
      for (const g of grants) {
        if (remaining <= 0) break;
        const clawable = Math.max(0, g.remainingAmount - (g.reservedAmount ?? 0));
        if (clawable <= 0) continue;
        const take = Math.min(clawable, remaining);
        const upd = await tx.creditGrant.updateMany({
          where: { id: g.id, remainingAmount: { gte: take } },
          data: { remainingAmount: { decrement: take } },
        });
        if (upd.count === 0) throw new Error('grant 摊扣失败（并发修改）'); // 防御：行锁内不应发生，发生即回滚
        remaining -= take;
      }

      // 审计：REFUND 负值 = 减少可用；referenceId = 渠道退款单；description/metadata 记录 refund 来源
      await tx.creditLedger.create({
        data: {
          userId: order.userId,
          type: LEDGER_TYPES.REFUND,
          amount: -clawed,
          referenceId: info.refundId ?? undefined,
          idempotencyKey,
          description: `支付退款扣回 ${clawed}（Creem ${info.refundId || ''}${info.refundReason ? `，原因：${info.refundReason}` : ''}${clawed < target ? '，余额不足部分放弃' : ''}）`,
          metadata: buildRefundMetadata(order, info, target, clawed) as unknown as Prisma.InputJsonObject,
        },
      });

      await tx.rechargeOrder.update({ where: { id: order.id }, data: { status: 'refunded' } });

      if (clawed < target) {
        console.warn(`[creem/refund] 订单 ${order.id} 退款扣回 ${clawed}/${target}（余额不足部分放弃，不做负余额）`);
      }
      return { ok: true as const, already: false as const, clawed };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, already: true, clawed: 0 };
    throw e;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = getPaymentProvider();

  if (providerParam !== provider.code) {
    return NextResponse.json({ error: 'unknown provider' }, { status: 404 });
  }
  if (provider.code === 'mock') {
    return NextResponse.json({ error: 'mock 无 webhook' }, { status: 400 });
  }

  const rawBody = await req.text();
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  let result;
  try {
    result = await provider.verifyWebhook(rawBody, headers);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'webhook 处理失败' }, { status: 500 });
  }

  if (!result.valid) {
    return NextResponse.json({ error: result.reason || 'invalid signature' }, { status: 401 });
  }

  // —— Refund 事件：扣回未消耗额度（幂等 + 部分扣回 + 审计） ——
  if (result.event === 'refund.created') {
    if (!result.orderId) {
      // 解析不到我方订单号：无法定位扣回目标 → 500 让渠道按退避重试（5 次），避免静默丢退款
      return NextResponse.json({ error: 'refund event 缺 orderId' }, { status: 500 });
    }
    const info = result as RefundWebhookInfo;
    const clawed = await clawbackRechargeRefund(result.orderId, info);
    if (!clawed.ok) {
      return NextResponse.json({ error: clawed.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, refunded: clawed.clawed, already: clawed.already });
  }

  // —— 支付成功：到账（补单仅限真实已收款订单：allowExpired + expectedProviderOrderId + Ledger 审计） ——
  if (!result.paid) {
    return NextResponse.json({ ok: true, ignored: true, event: result.event });
  }

  // 防御：订单已被退款标记（refund 先于到账投递的极端时序）→ 拒绝到账，杜绝「退款后补单」
  const pre = await prisma.rechargeOrder.findUnique({
    where: { id: result.orderId },
    select: { status: true },
  });
  if (pre && pre.status === 'refunded') {
    return NextResponse.json({ ok: true, ignored: true, reason: 'order_refunded', event: result.event });
  }

  const grant = await grantRechargeOrder(result.orderId, {
    allowExpired: true,
    expectedProviderOrderId: result.providerOrderId || undefined,
  });
  if (!grant.ok) {
    return NextResponse.json({ error: grant.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, granted: grant.granted, already: grant.already });
}
