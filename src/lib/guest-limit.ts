/**
 * 游客翻译限流（审计 P0 修复）
 * - 频率：内存滑动窗口（复用 rate-limit.ts），60s / GUEST_LIMITS.freqMax 次
 * - 日预算：DB 持久化（GuestUsage 表，ipHash+date 复合唯一），重启不绕过
 * - 仅统计真实 API 调用：缓存命中不进入本模块；翻译成功才计次/计字符
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp, hashKey } from '@/lib/rate-limit';
import { GUEST_LIMITS } from '@/lib/limits-config';

export type GuestLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number; error: string; code: string };

/** 请求进入时的检查（翻译成功与否都消耗一次频率积分；日预算只在成功后计） */
export async function checkGuestLimit(req: NextRequest): Promise<GuestLimitResult> {
  const ipHash = getGuestIpHash(req);

  // 1. 频率（内存，防脚本刷）
  const freq = rateLimit(`guest:freq:${ipHash}`, { windowMs: GUEST_LIMITS.windowMs, max: GUEST_LIMITS.freqMax });
  if (!freq.ok) {
    return {
      ok: false,
      retryAfterMs: freq.retryAfterMs,
      error: '翻译太频繁了，请稍后再试（游客每分钟限 ' + GUEST_LIMITS.freqMax + ' 次，登录后不限速）',
      code: 'RATE_LIMITED',
    };
  }

  // 2. 日预算（DB 持久化）
  const today = todayStr();
  const row = await prisma.guestUsage.findUnique({ where: { ipHash_date: { ipHash, date: today } } });
  if (row && (row.count >= GUEST_LIMITS.dailyMax || row.chars >= GUEST_LIMITS.dailyChars)) {
    return {
      ok: false,
      retryAfterMs: 0,
      error: '今日游客免费翻译积分已用完（每天 ' + GUEST_LIMITS.dailyMax + ' 次 / ' + GUEST_LIMITS.dailyChars + ' 字符），登录后解锁更多积分',
      code: 'DAILY_LIMIT',
    };
  }
  return { ok: true };
}

/** 翻译成功后的记录（计次 + 计字符） */
export async function recordGuestUsage(req: NextRequest, chars: number): Promise<void> {
  const ipHash = getGuestIpHash(req);
  const date = todayStr();
  await prisma.guestUsage.upsert({
    where: { ipHash_date: { ipHash, date } },
    create: { ipHash, date, count: 1, chars },
    update: { count: { increment: 1 }, chars: { increment: chars } },
  });
}

function getGuestIpHash(req: NextRequest): string {
  const ip = getClientIp(req.headers);
  return hashKey(['guest', ip]);
}

function todayStr(): string {
  // 用服务器本地日期（Asia/Shanghai）
  const d = new Date(Date.now() + 8 * 3600_000);
  return d.toISOString().slice(0, 10);
}
