/**
 * Credit Engine · 统一计费核心（行锁版）
 *
 * 生命周期：Reserve → (Consume + Release) | Refund
 * 不变量：
 *   1. 余额永不为负（行锁 SELECT ... FOR UPDATE + 应用层检查）
 *   2. 同一操作幂等（CreditLedger.idempotencyKey 唯一约束兜底）
 *   3. 所有变化 append-only 写入 CreditLedger（历史不可覆盖）
 *   4. Reserve 最终必须终结于 Consume 或 Release（扫描器兜底）
 *
 * 并发模型：PostgreSQL 行锁（FOR UPDATE）串行化同一账户的额度操作；
 *   相对减（decrement）配合行锁后，余额判断在锁内完成，杜绝超卖。
 */
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import {
  ReserveInput, ConsumeInput, ReleaseInput, RefundInput, GrantInput,
  CreditBalance, LEDGER_TYPES, JOB_CREDIT_STATE,
} from './types';
import { sortGrantsForConsumption } from './policy';

const IDEMPOTENT_ERROR = 'P2002';

function idempotentKeyExists(key: string): Promise<boolean> {
  return prisma.creditLedger.findUnique({ where: { idempotencyKey: key }, select: { id: true } }).then(Boolean);
}

/** 惰性创建额度账户（用户首次接触额度时） */
export async function ensureCreditAccount(userId: string): Promise<void> {
  await prisma.creditAccount.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, reservedBalance: 0 },
  });
}

/** 读取余额（性能缓存读取；对账以 Ledger 为准） */
export async function getBalance(userId: string): Promise<CreditBalance> {
  const acc = await prisma.creditAccount.findUnique({ where: { userId } });
  if (!acc) return { available: 0, reserved: 0, total: 0 };
  return { available: acc.balance, reserved: acc.reservedBalance, total: acc.balance + acc.reservedBalance };
}

/** 行锁：锁住账户行，返回最新余额（必须在 $transaction 内调用） */
async function lockAccount(tx: Prisma.TransactionClient, userId: string): Promise<{ id: string; balance: number; reservedBalance: number } | null> {
  const rows: any[] = await tx.$queryRaw`SELECT id, balance, "reservedBalance" FROM "CreditAccount" WHERE "userId" = ${userId} FOR UPDATE`;
  return rows[0] ?? null;
}

/** 同事务内检查幂等（比先查后插更稳：事务内查） */
async function txIdempotent(tx: Prisma.TransactionClient, key: string): Promise<boolean> {
  const found = await tx.creditLedger.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
  return !!found;
}

/**
 * Reserve：预留额度（异步任务开始前）
 * 行锁 + 应用层余额检查 → 原子扣 available → 写 Ledger + UsageRecord
 */
export async function reserve(input: ReserveInput): Promise<{ ok: true; reserved: number } | { ok: false; error: 'insufficient' | 'idempotent' }> {
  await ensureCreditAccount(input.userId);
  const x = Math.max(1, Math.round(input.estimatedCredits));

  try {
    return await prisma.$transaction(async (tx) => {
      // 幂等（事务内）
      if (await txIdempotent(tx, input.idempotencyKey)) return { ok: true as const, reserved: x };

      // 行锁
      const acc = await lockAccount(tx, input.userId);
      if (!acc) return { ok: false as const, error: 'insufficient' as const };
      if (acc.balance < x) return { ok: false as const, error: 'insufficient' as const };

      await tx.creditAccount.update({
        where: { id: acc.id },
        data: { balance: { decrement: x }, reservedBalance: { increment: x }, version: { increment: 1 } },
      });

      const usage = await tx.usageRecord.create({
        data: {
          userId: input.userId,
          feature: input.feature,
          jobId: input.jobId,
          estimatedCredits: x,
          reservedCredits: x,
          status: 'reserved',
          pricingRuleVersion: 1,
          metadata: (input.metadata as Prisma.InputJsonObject) ?? undefined,
        },
      });

      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: LEDGER_TYPES.RESERVE,
          amount: 0, // 形态变化：available→reserved，总价值不变
          jobId: input.jobId,
          usageId: usage.id,
          idempotencyKey: input.idempotencyKey,
          description: `预留 ${x}（${input.feature}）`,
        },
      });

      return { ok: true as const, reserved: x };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, reserved: x };
    throw e;
  }
}

/**
 * Consume：任务成功后按实际用量结算
 */
export async function consume(input: ConsumeInput): Promise<{ ok: true; consumed: number } | { ok: false; error: string }> {
  const y = Math.max(1, Math.round(input.actualCredits));

  try {
    return await prisma.$transaction(async (tx) => {
      if (await txIdempotent(tx, input.idempotencyKey)) return { ok: true as const, consumed: y };

      const acc = await lockAccount(tx, input.userId);
      if (!acc) return { ok: false as const, error: 'no_account' as const };
      if (acc.reservedBalance < y) return { ok: false as const, error: 'reserved_insufficient' as const };

      await tx.creditAccount.update({
        where: { id: acc.id },
        data: { reservedBalance: { decrement: y }, version: { increment: 1 } },
      });

      // grants 扣减：先过期先消费
      const grants = await tx.creditGrant.findMany({
        where: { userId: input.userId, remainingAmount: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { id: true, type: true, expiresAt: true, remainingAmount: true },
      });
      const ordered = sortGrantsForConsumption(grants as any);
      let remaining = y;
      let deductedTotal = 0;
      const deduction: Record<string, number> = {};
      for (const g of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(g.remainingAmount, remaining);
        await tx.creditGrant.updateMany({
          where: { id: g.id, remainingAmount: { gte: take } },
          data: { remainingAmount: { decrement: take } },
        });
        deduction[g.id] = (deduction[g.id] || 0) + take;
        remaining -= take;
        deductedTotal += take;
      }
      if (deductedTotal < y) {
        await tx.reconciliationRecord.create({
          data: {
            checkType: 'grants_vs_account',
            userId: input.userId,
            expected: y,
            actual: deductedTotal,
            diff: y - deductedTotal,
            detail: `consume ${input.jobId} grants 不足`,
            status: 'open',
          },
        });
      }

      await tx.usageRecord.updateMany({
        where: { id: input.usageId, status: 'reserved' },
        data: { consumedCredits: y, status: 'consumed', completedAt: new Date() },
      });

      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: LEDGER_TYPES.CONSUME,
          amount: -y,
          jobId: input.jobId,
          usageId: input.usageId,
          grantId: Object.keys(deduction).join(','),
          idempotencyKey: input.idempotencyKey,
          description: `翻译成功，实际消耗 ${y}`,
          metadata: { deduction } as unknown as Prisma.InputJsonObject,
        },
      });

      await tx.pdfJob.updateMany({ where: { taskId: input.jobId }, data: { creditState: JOB_CREDIT_STATE.CONSUMED, consumedCredits: y } }).catch(() => {});
      await tx.subtitleJob.updateMany({ where: { taskId: input.jobId }, data: { creditState: JOB_CREDIT_STATE.CONSUMED, consumedCredits: y } }).catch(() => {});
      await tx.translationJob.updateMany({ where: { id: input.jobId }, data: { creditState: JOB_CREDIT_STATE.CONSUMED, consumedCredits: y } }).catch(() => {});

      return { ok: true as const, consumed: y };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, consumed: y };
    throw e;
  }
}

/**
 * Release：任务失败/取消/预估高于实际时退回预留
 */
export async function release(input: ReleaseInput): Promise<{ ok: true; released: number } | { ok: false; error: string }> {
  const z = Math.max(0, Math.round(input.amount));
  if (z === 0) return { ok: true, released: 0 };

  try {
    return await prisma.$transaction(async (tx) => {
      if (await txIdempotent(tx, input.idempotencyKey)) return { ok: true as const, released: z };

      const acc = await lockAccount(tx, input.userId);
      if (!acc) return { ok: false as const, error: 'no_account' as const };
      if (acc.reservedBalance < z) return { ok: false as const, error: 'reserved_insufficient' as const };

      await tx.creditAccount.update({
        where: { id: acc.id },
        data: { reservedBalance: { decrement: z }, balance: { increment: z }, version: { increment: 1 } },
      });

      // grant 回补
      const grants = await tx.creditGrant.findMany({
        where: { userId: input.userId, reservedAmount: { gt: 0 } },
        select: { id: true, type: true, expiresAt: true, remainingAmount: true, reservedAmount: true },
      });
      const ordered = sortGrantsForConsumption(grants as any);
      let remaining = z;
      for (const g of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(g.reservedAmount ?? 0, remaining);
        await tx.creditGrant.updateMany({
          where: { id: g.id, reservedAmount: { gte: take } },
          data: { reservedAmount: { decrement: take }, remainingAmount: { increment: take } },
        });
        remaining -= take;
      }

      const usage = await tx.usageRecord.findUnique({ where: { id: input.usageId } });
      if (usage) {
        const finalStatus = usage.consumedCredits > 0 ? 'partial' : 'released';
        await tx.usageRecord.update({
          where: { id: input.usageId },
          data: { releasedCredits: { increment: z }, status: finalStatus, completedAt: new Date() },
        });
      }

      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: LEDGER_TYPES.RELEASE,
          amount: 0, // 形态变化：reserved→available，总价值不变
          jobId: input.jobId,
          usageId: input.usageId,
          idempotencyKey: input.idempotencyKey,
          description: `退回未用额度 ${z}`,
        },
      });

      return { ok: true as const, released: z };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, released: z };
    throw e;
  }
}

/**
 * Refund：已 consume 后因系统错误退款（append-only，不改原记录）
 */
export async function refund(input: RefundInput): Promise<{ ok: true; refunded: number } | { ok: false; error: string }> {
  const y = Math.max(1, Math.round(input.amount));

  try {
    return await prisma.$transaction(async (tx) => {
      if (await txIdempotent(tx, input.idempotencyKey)) return { ok: true as const, refunded: y };

      const acc = await lockAccount(tx, input.userId);
      if (!acc) return { ok: false as const, error: 'no_account' as const };

      await tx.creditAccount.update({
        where: { id: acc.id },
        data: { balance: { increment: y }, version: { increment: 1 } },
      });

      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: LEDGER_TYPES.REFUND,
          amount: y,
          jobId: input.jobId,
          idempotencyKey: input.idempotencyKey,
          description: `退款：${input.reason}`,
          metadata: input.metadata as unknown as Prisma.InputJsonObject,
        },
      });

      await tx.pdfJob.updateMany({ where: { taskId: input.jobId }, data: { creditState: JOB_CREDIT_STATE.REFUNDED } }).catch(() => {});
      await tx.subtitleJob.updateMany({ where: { taskId: input.jobId }, data: { creditState: JOB_CREDIT_STATE.REFUNDED } }).catch(() => {});
      await tx.translationJob.updateMany({ where: { id: input.jobId }, data: { creditState: JOB_CREDIT_STATE.REFUNDED } }).catch(() => {});

      return { ok: true as const, refunded: y };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, refunded: y };
    throw e;
  }
}

/**
 * Grant：发放额度批次（注册赠送/购买/月度/Admin 调整）
 */
export async function grantCredits(input: GrantInput): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      if (await txIdempotent(tx, input.idempotencyKey)) return { ok: true as const, grantId: 'idempotent' };

      const acc = await lockAccount(tx, input.userId);
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
          type: input.type === 'ADMIN_ADJUSTMENT' ? LEDGER_TYPES.ADMIN_ADJUST : LEDGER_TYPES.GRANT,
          amount: input.amount,
          grantId: grant.id,
          idempotencyKey: input.idempotencyKey,
          description: `${input.source} +${input.amount}${input.reason ? `（${input.reason}）` : ''}`,
          metadata: (input.adminId ? { adminId: input.adminId } : undefined) as Prisma.InputJsonObject | undefined,
        },
      });

      return { ok: true as const, grantId: grant.id };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, grantId: 'idempotent' };
    throw e;
  }
}

/** 额度到期处理（写 Ledger expire，不 DELETE） */
export async function expireCredits(): Promise<{ expired: number; freed: number }> {
  const now = new Date();
  const expiredGrants = await prisma.creditGrant.findMany({
    where: { expiresAt: { lt: now }, remainingAmount: { gt: 0 } },
    select: { id: true, userId: true, remainingAmount: true },
  });

  let freed = 0;
  for (const g of expiredGrants) {
    await prisma.$transaction(async (tx) => {
      // 行锁账户，防止与消费竞态
      const acc = await lockAccount(tx, g.userId);
      if (!acc) return;
      const upd = await tx.creditGrant.updateMany({
        where: { id: g.id, remainingAmount: { gt: 0 } },
        data: { remainingAmount: 0, reservedAmount: 0 },
      });
      if (upd.count === 0) return;
      await tx.creditAccount.update({
        where: { id: acc.id },
        data: { balance: { decrement: g.remainingAmount }, version: { increment: 1 } },
      });
      await tx.creditLedger.create({
        data: {
          userId: g.userId,
          type: LEDGER_TYPES.EXPIRE,
          amount: -g.remainingAmount,
          grantId: g.id,
          idempotencyKey: `expire:${g.id}:${now.getTime()}`,
          description: `${g.remainingAmount} 个额度已到期`,
        },
      });
    }).catch((e: any) => {
      if (e?.code === IDEMPOTENT_ERROR) return;
      console.error('[credit/expire] grant', g.id, 'failed:', e?.message);
    });
    freed += g.remainingAmount;
  }
  return { expired: expiredGrants.length, freed };
}

/** Admin 调整（正=发放，负=扣减；扣减走 grants + account，余额不足拒绝） */
export async function adminAdjustment(input: GrantInput & { amount: number }): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  if (input.amount >= 0) return grantCredits(input);
  const deficit = -input.amount;

  try {
    return await prisma.$transaction(async (tx) => {
      if (await txIdempotent(tx, input.idempotencyKey)) return { ok: true as const, grantId: 'idempotent' };

      const acc = await lockAccount(tx, input.userId);
      if (!acc) return { ok: false as const, error: 'no_account' as const };
      if (acc.balance < deficit) return { ok: false as const, error: 'insufficient' as const };

      await tx.creditAccount.update({
        where: { id: acc.id },
        data: { balance: { decrement: deficit }, version: { increment: 1 } },
      });

      const grants = await tx.creditGrant.findMany({
        where: { userId: input.userId, remainingAmount: { gt: 0 } },
        select: { id: true, type: true, expiresAt: true, remainingAmount: true },
      });
      const ordered = sortGrantsForConsumption(grants as any);
      let remaining = deficit;
      for (const g of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(g.remainingAmount, remaining);
        await tx.creditGrant.updateMany({
          where: { id: g.id, remainingAmount: { gte: take } },
          data: { remainingAmount: { decrement: take } },
        });
        remaining -= take;
      }

      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: LEDGER_TYPES.ADMIN_ADJUST,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          description: `管理员调整 ${input.amount}（${input.source}）${input.reason ? `：${input.reason}` : ''}`,
          metadata: (input.adminId ? { adminId: input.adminId } : undefined) as Prisma.InputJsonObject | undefined,
        },
      });
      return { ok: true as const, grantId: 'admin' };
    });
  } catch (e: any) {
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, grantId: 'idempotent' };
    throw e;
  }
}
