import { prisma } from '@/lib/db';

/**
 * Trending V1（流量增长 V1.0 Week 4）——热梗榜数据源
 * 评分 = 编辑热度 popularity（0-100 锚）+ 近 7 天真实 pageview 归一化加权
 * 编辑分保证冷启动有内容、新站不空榜；真实访问占比随流量增长自然上升
 * 10 分钟内存缓存（ContentMetrics groupBy 每次全表聚合，避免高频扫描）
 */
const TTL = 10 * 60 * 1000;
let cache: { at: number; data: Awaited<ReturnType<typeof computeTrending>> } | null = null;

async function computeTrending(limit: number) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [entries, pvRows] = await Promise.all([
    prisma.memeEntry.findMany({
      where: { status: 'published' },
      select: { id: true, slug: true, term: true, meaning: true, translation: true, popularity: true, lang: true }, // __p0mlink__
    }),
    prisma.contentMetrics.groupBy({
      by: ['contentId'],
      _sum: { pageviews: true },
      where: { contentType: 'meme', date: { gte: since } },
    }).catch(() => [] as { contentId: string; _sum: { pageviews: number | null } }[]),
  ]);

  const pvById = new Map(pvRows.map((r) => [r.contentId, r._sum.pageviews || 0]));
  const maxPv = Math.max(1, ...pvById.values());

  const scored = entries.map((e) => {
    const pv = pvById.get(e.id) || 0;
    const pvNorm = pv / maxPv; // 0-1
    const popNorm = Math.max(0, Math.min(1, e.popularity / 100));
    const score = popNorm * 0.7 + pvNorm * 0.3; // V1 权重：编辑 70% / 真实访问 30%
    return { ...e, pv, score };
  });
  scored.sort((a, b) => b.score - a.score || b.popularity - a.popularity);
  return scored.slice(0, limit);
}

export async function getTrendingMemes(limit = 10) {
  if (cache && Date.now() - cache.at < TTL && cache.data.length >= limit) {
    return cache.data.slice(0, limit);
  }
  try {
    const data = await computeTrending(limit);
    cache = { at: Date.now(), data };
    return data;
  } catch {
    // 指标失败降级：纯编辑热度（不打断页面渲染）
    return prisma.memeEntry.findMany({
      where: { status: 'published' },
      orderBy: { popularity: 'desc' },
      take: limit,
      select: { id: true, slug: true, term: true, meaning: true, translation: true, popularity: true },
    }).then((rows) => rows.map((e) => ({ ...e, pv: 0, score: 0 }))); // __p0mlink-trending2__
  }
}
