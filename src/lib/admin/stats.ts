/**
 * 只读运营统计数据源（供 /api/stats 与 /api/admin/export 复用）
 * 统计维度：用户 / 内容 / 盲测 / 翻译 / PDF
 */
import { prisma } from '@/lib/db';

export interface StatsData {
  users: { total: number; activeSessions: number; creditAccounts: number };
  content: { memes: number; memesByStatus: Record<string, number>; blindtestsByStatus: Record<string, number> };
  blindtest: { total: number; votes: number; votesByModel: Record<string, number> };
  translation: {
    total: number;
    cached: number;
    cacheHitRate: number;
    byModel: Record<string, { calls: number; costUsd: number }>;
    costUsdTotal: number;
    last7Days: { date: string; count: number }[];
  };
  pdf: {
    jobs: number;
    costUsdTotal: number;
    avgDurationMs: number;
    p50DurationMs: number;
    p95DurationMs: number;
    events: Record<string, number>;
  };
}

export async function collectStats(): Promise<StatsData> {
  const [
    blindtestCount, voteCount, voteByModel, jobCount, jobByModel, jobCost, cachedCount, recentDaily,
    pdfJobCount, pdfAgg, pdfDurations, pdfEvents,
    userCount, activeSessions, memeCount, memeByStatus, blindtestByStatus, accountCount,
  ] = await Promise.all([
    prisma.blindtest.count(),
    prisma.vote.count(),
    prisma.vote.groupBy({ by: ['model'], _count: { _all: true } }),
    prisma.translationJob.count(),
    prisma.translationJob.groupBy({ by: ['model'], _count: { _all: true }, _sum: { costUsd: true } }),
    prisma.translationJob.aggregate({ _sum: { costUsd: true } }),
    prisma.translationJob.count({ where: { cached: true } }),
    prisma.translationJob.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      _count: { _all: true },
    }),
    prisma.pdfJob.count(),
    prisma.pdfJob.aggregate({ _sum: { totalCostUsd: true }, _avg: { durationMs: true } }),
    prisma.pdfJob.findMany({ where: { status: 'completed', durationMs: { not: null } }, select: { durationMs: true }, take: 200 }),
    prisma.pdfEvent.groupBy({ by: ['event'], _count: { _all: true } }),
    prisma.user.count(),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.memeEntry.count(),
    prisma.memeEntry.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.blindtest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.creditAccount.count(),
  ]);

  const dailyMap = new Map<string, number>();
  for (const d of recentDaily) {
    const day = d.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + d._count._all);
  }
  const daily = [...dailyMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    users: { total: userCount, activeSessions, creditAccounts: accountCount },
    content: {
      memes: memeCount,
      memesByStatus: Object.fromEntries(memeByStatus.map((m) => [m.status, m._count._all])),
      blindtestsByStatus: Object.fromEntries(blindtestByStatus.map((b) => [b.status, b._count._all])),
    },
    blindtest: { total: blindtestCount, votes: voteCount, votesByModel: Object.fromEntries(voteByModel.map((v) => [v.model, v._count._all])) },
    translation: {
      total: jobCount,
      cached: cachedCount,
      cacheHitRate: jobCount > 0 ? Number((cachedCount / jobCount).toFixed(4)) : 0,
      byModel: Object.fromEntries(jobByModel.map((j) => [j.model, { calls: j._count._all, costUsd: Number((j._sum.costUsd ?? 0).toFixed(6)) }])),
      costUsdTotal: Number((jobCost._sum.costUsd ?? 0).toFixed(6)),
      last7Days: daily,
    },
    pdf: {
      jobs: pdfJobCount,
      costUsdTotal: Number((pdfAgg._sum.totalCostUsd ?? 0).toFixed(6)),
      avgDurationMs: pdfAgg._avg.durationMs ? Math.round(pdfAgg._avg.durationMs) : 0,
      p50DurationMs: percentile(pdfDurations.map((d) => d.durationMs as number), 50),
      p95DurationMs: percentile(pdfDurations.map((d) => d.durationMs as number), 95),
      events: Object.fromEntries(pdfEvents.map((e) => [e.event, e._count._all])),
    },
  };
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
