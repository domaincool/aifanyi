/**
 * 管理后台鉴权（Phase B）：运营 Agent（Bearer Ops Token）+ 人工管理员（session + ADMIN_EMAILS）
 *
 * 双通道：
 *  - ops：Authorization: Bearer <OPS_API_TOKEN>（机器调用，运营 Agent 主通道）
 *  - admin：浏览器 session 命中 ADMIN_EMAILS（人工）
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';
import { isAdminEmail } from '@/lib/credit/admin-auth';

export type OpsIdentity =
  | { kind: 'ops'; operator: string }
  | { kind: 'admin'; operator: string; userId: string };

/** 统一入口：ops token 或 admin session，都不满足 → null */
export async function requireOpsOrAdmin(req?: NextRequest | null): Promise<OpsIdentity | null> {
  // 1. Bearer Ops Token
  const authHeader = req?.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const opsToken = process.env.OPS_API_TOKEN || '';
    if (opsToken && token === opsToken) {
      return { kind: 'ops', operator: 'ops-token' };
    }
    return null; // 错 token 直接拒绝，不降级到 session
  }
  // 2. 浏览器 session + ADMIN_EMAILS
  const auth = await getAuthUserId();
  if (!auth) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  if (!user || !isAdminEmail(user.email)) return null;
  return { kind: 'admin', operator: user.email!, userId: auth.userId };
}

/** 写审计日志（所有管理写操作） */
export async function logAdminAction(input: {
  identity: OpsIdentity;
  action: string;
  targetId?: string | null;
  batchId?: string | null;
  params?: unknown;
  result?: unknown;
  ip?: string | null;
}) {
  await prisma.adminLog.create({
    data: {
      operator: input.identity.operator,
      action: input.action,
      targetId: input.targetId ?? null,
      batchId: input.batchId ?? null,
      params: (input.params as object) ?? undefined,
      result: (input.result as object) ?? undefined,
      ip: input.ip ?? null,
    },
  });
}

/** 管理写操作限流：按 operator 维度，10 分钟内最多 max 次（DB 计数，多实例安全） */
export async function checkOpsRateLimit(operator: string, actionPrefix: string, max = 20): Promise<{ ok: boolean; remaining: number }> {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const count = await prisma.adminLog.count({
    where: { operator, action: { startsWith: actionPrefix }, createdAt: { gte: since } },
  });
  return { ok: count < max, remaining: Math.max(0, max - count) };
}
