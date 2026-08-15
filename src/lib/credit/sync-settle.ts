/**
 * 同步请求额度接入（阶段 3：image / web / doc 堵成本漏洞）
 *
 * 流程：认证 → 估算 → beginSync(reserve 原子检查余额) → 翻译 → endSyncSuccess(consume 实际+退差额) / endSyncFail(release 全部)
 * 产品原则：只有成功才扣、提交前拦截不足、按实际结算、游客引导登录
 */
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { reserve, consume, release } from './engine';
import { FEATURES, type Feature } from './types';
import { estimateCredits } from './pricing';

export type SyncAuth = { userId: string } | null;

/** 认证：未登录 / session 失效 → null（由调用方返回 401 文案） */
export async function getAuthUserId(): Promise<SyncAuth> {
  const token = await getSessionCookie();
  if (!token) return null;
  const user = await validateSession(token);
  if (!user) return null;
  return { userId: user.userId };
}

export function authErrorBody() {
  return {
    ok: false as const,
    code: 'auth_required',
    error: '请先登录后再使用该功能。登录后新用户可获赠 500 免费额度，用完再按用量计费。',
  };
}

export function insufficientBody(estimated: number, available: number) {
  return {
    ok: false as const,
    code: 'insufficient',
    error: `本次预计消耗约 ${estimated} 额度，当前剩余 ${available} 额度，请先补充额度后再试。`,
    estimated,
    available,
  };
}

export type BeginResult =
  | { ok: true; usageId: string; estimated: number }
  | { ok: false; code: string; error: string };

/** 阶段 1：reserve（原子检查余额），返回 usageId */
export async function beginSync(input: {
  userId: string;
  jobId: string;
  feature: Feature;
  estimatedCredits: number;
}): Promise<BeginResult> {
  const est = Math.max(1, Math.round(input.estimatedCredits));
  const r = await reserve({
    userId: input.userId,
    jobId: input.jobId,
    feature: input.feature,
    estimatedCredits: est,
    idempotencyKey: `${input.jobId}:reserve`,
  });
  if (!r.ok) {
    if (r.error === 'insufficient') {
      const acc = await prisma.creditAccount.findUnique({ where: { userId: input.userId } });
      return { ok: false, code: 'insufficient', error: insufficientBody(est, acc?.balance ?? 0).error };
    }
    return { ok: false, code: 'engine_error', error: '额度服务暂不可用，请稍后再试。' };
  }
  const usage = await prisma.usageRecord.findFirst({
    where: { userId: input.userId, jobId: input.jobId },
    select: { id: true },
  });
  if (!usage) return { ok: false, code: 'engine_error', error: '额度记录异常，请稍后再试。' };
  return { ok: true, usageId: usage.id, estimated: est };
}

/** 阶段 2（成功）：按实际消耗结算，差额自动退回 */
export async function endSyncSuccess(input: {
  userId: string;
  jobId: string;
  usageId: string;
  estimated: number;
  actualCredits: number;
}): Promise<{ ok: boolean; consumed: number; error?: string }> {
  const est = input.estimated;
  const actual = Math.min(Math.max(0, Math.round(input.actualCredits)), est);
  if (actual === 0) {
    await release({ userId: input.userId, jobId: input.jobId, usageId: input.usageId, amount: est, idempotencyKey: `${input.jobId}:release` });
    return { ok: true, consumed: 0 };
  }
  const c = await consume({
    userId: input.userId,
    jobId: input.jobId,
    usageId: input.usageId,
    actualCredits: actual,
    idempotencyKey: `${input.jobId}:consume`,
  });
  if (!c.ok) {
    await release({ userId: input.userId, jobId: input.jobId, usageId: input.usageId, amount: est, idempotencyKey: `${input.jobId}:release` });
    return { ok: false, consumed: 0, error: '额度结算异常，本次已全额退回，请稍后再试。' };
  }
  if (est > actual) {
    await release({ userId: input.userId, jobId: input.jobId, usageId: input.usageId, amount: est - actual, idempotencyKey: `${input.jobId}:release` });
  }
  return { ok: true, consumed: actual };
}

/** 阶段 2（失败）：退回全部预留（幂等，安全可重复调用） */
export async function endSyncFail(input: {
  userId: string;
  jobId: string;
  usageId: string;
  estimated: number;
}): Promise<void> {
  try {
    await release({ userId: input.userId, jobId: input.jobId, usageId: input.usageId, amount: input.estimated, idempotencyKey: `${input.jobId}:release` });
  } catch (e: any) {
    console.error('[credit/endSyncFail]', e?.message || e);
  }
}

/** 按字符数估算（web/doc 共用：按 PricingRule，2 credits / 千字） */
export async function estimateByChars(feature: Feature, chars: number): Promise<number> {
  const rule = await estimateCredits(feature, Math.max(0, Math.round(chars / 1000)));
  return rule?.credits ?? Math.max(1, Math.ceil(chars / 1000) * 20);
}

export { FEATURES };
