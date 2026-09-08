/**
 * GET /api/stats — 只读运营统计（盲测/翻译/成本/PDF/用户/内容 + 内容系统指标）
 * 权限：requireOpsOrAdmin（运营 Agent Bearer token 或 admin session）
 * 用途：运营监控基线（每周快照 / 任意时刻自查）+ 管理看板 + spec §36 Dashboard 数据源
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/admin/ops-auth';
import { collectStats } from '@/lib/admin/stats';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  try {
    const data = await collectStats();

    // ── 内容系统指标（V1.0 Week3：spec §36 Dashboard 数据源；失败不影响主 stats）──
    let contentStats: Record<string, unknown> = {};
    try {
      const since = new Date(Date.now() - 7 * 86400_000);
      const [pv, toolClicks, signups, daily, relations, shortAnswerFilled, definitionFilled] = await Promise.all([
        prisma.contentMetrics.aggregate({ _sum: { pageviews: true }, where: { date: { gte: since } } }),
        prisma.contentMetrics.aggregate({ _sum: { toolClicks: true }, where: { date: { gte: since } } }),
        prisma.contentMetrics.aggregate({ _sum: { signups: true }, where: { date: { gte: since } } }),
        prisma.contentMetrics.groupBy({ by: ['date'], _sum: { pageviews: true, toolClicks: true }, where: { date: { gte: since } }, orderBy: { date: 'asc' } }),
        prisma.contentRelation.count(),
        prisma.memeEntry.count({ where: { shortAnswer: { not: null } } }),
        prisma.memeEntry.count({ where: { definition: { not: null } } }),
      ]);
      const totalMeme = await prisma.memeEntry.count();
      const pvTotal = pv._sum.pageviews || 0;
      const tcTotal = toolClicks._sum.toolClicks || 0;
      contentStats = {
        last7d: {
          pageviews: pvTotal,
          toolClicks: tcTotal,
          signups: signups._sum.signups || 0,
          contentToolCtr: pvTotal > 0 ? (tcTotal / pvTotal * 100).toFixed(1) + '%' : '0%',
          daily: daily.map((d: { date: Date; _sum: { pageviews: number | null; toolClicks: number | null } }) => ({ date: d.date, pageviews: d._sum.pageviews || 0, toolClicks: d._sum.toolClicks || 0 })),
        },
        knowledgeGraph: { relations, source: 'tags-coldstart' },
        fieldCompletion: {
          meme: {
            total: totalMeme,
            shortAnswer: shortAnswerFilled,
            definition: definitionFilled,
            shortAnswerPct: totalMeme > 0 ? (shortAnswerFilled / totalMeme * 100).toFixed(1) + '%' : '0%',
            definitionPct: totalMeme > 0 ? (definitionFilled / totalMeme * 100).toFixed(1) + '%' : '0%',
          },
        },
      };
    } catch { /* 内容指标失败不影响主 stats */ }

    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      operator: identity.operator,
      ...data,
      contentStats,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
