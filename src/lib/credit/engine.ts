/**
 * Credit Engine · 统一计费核心
 *
 * 生命周期：Reserve → (Consume + Release) | Refund
 * 不变量：
 *   1. 余额永不为负（原子 UPDATE ... WHERE balance >= x）
 *   2. 同一操作幂等（CreditLedger.idempotencyKey 唯一约束兜底）
 *   3. 所有变化 append-only 写入 CreditLedger（历史不可覆盖）
 *   4. Reserve 最终必须终结于 Consume 或 Release（扫描器兜底）
 *
 * 并发模型：单条原子 UPDATE 作为锁；跨表一致性由 prisma.$transaction 保证
 */
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import {
  ReserveInput, ConsumeInput, ReleaseInput, RefundInput, GrantInput,
  CreditBalance, LEDGER_TYPES, JOB_CREDIT_STATE,
} from './types';
import { sortGrantsForConsumption } from './policy';

const IDEMPOTENT_ERROR = 'P2002'; // Prisma unique constraint

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

/**
 * Reserve：预留额度（异步任务开始前）
 * - 原子扣减 available → reserved（余额不足返回 insufficient）
 * - 写 Ledger(-x, reserve) + UsageRecord(reserved)
 * - 幂等：同 jobId:reserve 重复调用返回首次结果
 */
export async function reserve(input: ReserveInput): Promise<{ ok: true; reserved: number } | { ok: false; error: 'insufficient' | 'idempotent' }> {
  await ensureCreditAccount(input.userId);

  // 幂等检查（先查后插，唯一约束兜底）
  if (await idempotentKeyExists(input.idempotencyKey)) return { ok: true, reserved: input.estimatedCredits };

  const x = Math.max(1, Math.round(input.estimatedCredits));

  try {
    return await prisma.$transaction(async (tx) => {
      // 原子预留：balance >= x 才成功
      const upd = await tx.creditAccount.updateMany({
        where: { userId: input.userId, balance: { gte: x } },
        data: { balance: { decrement: x }, reservedBalance: { increment: x }, version: { increment: 1 } },
      });
      if (upd.count === 0) return { ok: false as const, error: 'insufficient' as const };

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
          amount: -x,
          jobId: input.jobId,
          usageId: usage.id,
          idempotencyKey: input.idempotencyKey,
          description: `预留 ${x}（${input.feature}）`,
        },
      });

      return { ok: true as const, reserved: x };
    });
  } catch (e: any) {
    // 幂等键冲突（并发重复）→ 视为幂等成功
    if (e?.code === IDEMPOTENT_ERROR) return { ok: true, reserved: x };
    throw e;
  }
}

/**
 * Consume：任务成功后按实际用量结算
 * - reserved → consumed（account.reservedBalance 减）
 * - 从 Grants 按消费策略扣减 remainingAmount（先过期先消费）
 * - 写 Ledger(-y, consume) + UsageRecord(consumed=y)
 */
export async function consume(input: ConsumeInput): Promise<{ ok: true; consumed: number } | { ok: false; error: string }> {
  if (await idempotentKeyExists(input.idempotencyKey)) return { ok: true, consumed: input.actualCredits };

  const y = Math.max(1, Math.round(input.actualCredits));

  try {
    return await prisma.$transaction(async (tx) => {
      // 1) account: reservedBalance 减（可用不变，reserve 时已扣）
      const upd = await tx.creditAccount.updateMany({
        where: { userId: input.userId, reservedBalance: { gte: y } },
        data: { reservedBalance: { decrement: y }, version: { increment: 1 } },
      });
      if (upd.count === 0) return { ok: false as const, error: 'reserved_insufficient' as const };

      // 2) grants 扣减：先过期先消费
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
      // 极端情况：grants 总额不足（expire 竞态）→ 记录对账异常，按实际扣
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

      // 3) UsageRecord + Ledger
      const usage = await tx.usageRecord.updateMany({
        where: { id: input.usageId, status: 'reserved' },
        data: { consumedCredits: y, status: 'consumed', completedAt: new Date() },
      });
      if (usage.count === 0) {
        // usage 不存在或已结算：仅写 ledger（幂等由 key 兜底）
      }

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

      // 4) Job credit 状态
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
 * Release：任务失败/取消/预估高于实际时，退回预留
 * - reserved → available 回补（account）
 * - Grants 回补 remainingAmount（按 consume 后未扣部分；release 全量时原路退回）
 * - 写 Ledger(+z, release) + UsageRecord(released=z, status=released/partial)
 */
export async function release(input: ReleaseInput): Promise<{ ok: true; released: number } | { ok: false; error: string }> {
  if (await idempotentKeyExists(input.idempotencyKey)) return { ok: true, released: input.amount };

  const z = Math.max(0, Math.round(input.amount));
  if (z === 0) return { ok: true, released: 0 };

  try {
    return await prisma.$transaction(async (tx) => {
      // 1) account：reserved → available
      const upd = await tx.creditAccount.updateMany({
        where: { userId: input.userId, reservedBalance: { gte: z } },
        data: { reservedBalance: { decrement: z }, balance: { increment: z }, version: { increment: 1 } },
      });
      if (upd.count === 0) return { ok: false as const, error: 'reserved_insufficient' as const };

      // 2) grant 回补（尽量退回，若 grants 已消费完则跳过；对账会在 expire 时兜底）
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

      // 3) UsageRecord 状态（若已 consume 过 → partial；否则 released）
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
          amount: z,
          jobId: input.jobId,
          usageId: input.usageId,
          idempotencyKey: input.idempotencyKey,
          description: z > 0 ? `退回未用额度 ${z}` : '无需退回',
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
 * Refund：已 consume 后因系统错误退款
 * - available 回补 + 写 Ledger(+amount, refund)
 * - 不改原 consume 记录（append-only）
 */
export async function refund(input: RefundInput): Promise<{ ok: true; refunded: number } | { ok: false; error: string }> {
  if (await idempotentKeyExists(input.idempotencyKey)) return { ok: true, refunded: input.amount };

  const y = Math.max(1, Math.round(input.amount));

  try {
    return await prisma.$transaction(async (tx) => {
      const upd = await tx.creditAccount.updateMany({
        where: { userId: input.userId },
        data: { balance: { increment: y }, version: { increment: 1 } },
      });
      if (upd.count === 0) return { ok: false as const, error: 'no_account' as const };

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
 * 永不直接改 balance 总额——走 Grant + Ledger
 */
export async function grantCredits(input: GrantInput): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  if (await idempotentKeyExists(input.idempotencyKey)) return { ok: true, grantId: 'idempotent' };

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.creditAccount.upsert({
        where: { userId: input.userId },
        update: { balance: { increment: input.amount } },
        create: { userId: input.userId, balance: input.amount, reservedBalance: 0 },
      });

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

/**
 * 额度到期处理：把已过期 grant 的剩余额度清零（写 Ledger expire，不 DELETE）
 * 同时把对应 account.balance 减掉（保持 balance 与 ledger 一致）
 */
export async function expireCredits(): Promise<{ expired: number; freed: number }> {
  const now = new Date();
  const expiredGrants = await prisma.creditGrant.findMany({
    where: { expiresAt: { lt: now }, remainingAmount: { gt: 0 } },
    select: { id: true, userId: true, remainingAmount: true },
  });

  let freed = 0;
  for (const g of expiredGrants) {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.creditGrant.updateMany({
        where: { id: g.id, remainingAmount: { gt: 0 } },
        data: { remainingAmount: 0, reservedAmount: 0 },
      });
      if (upd.count === 0) return;
      // 同步扣减 account.balance（防重复由 remainingAmount>0 条件保证）
      await tx.creditAccount.updateMany({
        where: { userId: g.userId, balance: { gte: g.remainingAmount } },
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
    }).catch(async (e: any) => {
      if (e?.code === IDEMPOTENT_ERROR) return; // 已过期处理过
      console.error('[credit/expire] grant', g.id, 'failed:', e?.message);
    });
    freed += g.remainingAmount;
  }
  return { expired: expiredGrants.length, freed };
}

/** Admin 扣减（负向调整）：走 grant + ledger，余额不足则拒绝 */
export async function adminAdjustment(input: GrantInput & { amount: number }): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  if (input.amount >= 0) return grantCredits(input);
  // 负向：从 grants 扣（先过期先消费），account.balance 同步减
  const deficit = -input.amount;
  if (await idempotentKeyExists(input.idempotencyKey)) return { ok: true, grantId: 'idempotent' };

  try {
    return await prisma.$transaction(async (tx) => {
      const upd = await tx.creditAccount.updateMany({
        where: { userId: input.userId, balance: { gte: deficit } },
        data: { balance: { decrement: deficit }, version: { increment: 1 } },
      });
      if (upd.count === 0) return { ok: false as const, error: 'insufficient' as const };

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
