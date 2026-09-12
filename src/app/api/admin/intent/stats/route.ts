/**
 * /api/admin/intent/stats — 语言意图漏斗统计（V1.1 P1-7）
 *
 * 鉴权：requireOpsOrAdmin（Bearer Ops Token 或 admin session）
 * 查询：?days=7（默认 7，上限 90）
 *
 * 硬规则（数据诚实性）：
 *  - events < 100 → 所有 share/占比字段返回 null，不得用 0% 冒充真实占比
 *  - 未埋点项（signup / first_translation / credit_consume / payment）返回 null 并列入 gaps，
 *    不得显示为「0 转化」
 *  - SEO 指标（曝光/点击/CTR/排名）本接口不生成近似值，一律 null + note
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOpsOrAdmin } from '@/lib/admin/ops-auth';

export const dynamic = 'force-dynamic';

const INTENT_ORDER = ['translate', 'meaning', 'hidden_meaning', 'speak', 'other'];
const MIN_SAMPLE = 100;

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const daysRaw = parseInt(sp.get('days') || '7', 10);
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(1, daysRaw)) : 7;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.languageIntent
    .findMany({
      where: { enteredAt: { gte: from, lte: to } },
      select: {
        intent: true,
        source: true,
        channel: true,
        toolUsed: true,
        toolType: true,
        normalizedQuery: true,
        contentMatch: true,
        sessionKey: true,
      },
    })
    .catch(() => []);

  const events = rows.length;
  const sufficient = events >= MIN_SAMPLE;

  // ── byIntent（五枚举固定顺序 + 意外枚举追加）──
  const intentCounts = new Map<string, number>();
  for (const r of rows) intentCounts.set(r.intent, (intentCounts.get(r.intent) ?? 0) + 1);
  const extraIntents = [...intentCounts.keys()].filter((i) => !INTENT_ORDER.includes(i)).sort();
  const byIntent = [...INTENT_ORDER, ...extraIntents].map((intent) => {
    const count = intentCounts.get(intent) ?? 0;
    return { intent, count, share: sufficient ? round4(count / events) : null };
  });

  // ── bySource / byChannel（计数降序）──
  const groupCount = (keyFn: (r: (typeof rows)[number]) => string | null) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const kk = keyFn(r) ?? '(none)';
      m.set(kk, (m.get(kk) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([k, count]) => ({ key: k, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  };

  const bySource = groupCount((r) => r.source).map((x) => ({ source: x.key, count: x.count }));
  const byChannel = groupCount((r) => r.channel).map((x) => ({ channel: x.key, count: x.count }));

  // ── byTool（toolUsed 分组，内含 toolType 分布）──
  const toolMap = new Map<string, { count: number; types: Record<string, number> }>();
  for (const r of rows) {
    if (!r.toolUsed) continue;
    const cur = toolMap.get(r.toolUsed) ?? { count: 0, types: {} };
    cur.count++;
    const t = r.toolType || '(unknown)';
    cur.types[t] = (cur.types[t] ?? 0) + 1;
    toolMap.set(r.toolUsed, cur);
  }
  const byTool = [...toolMap.entries()]
    .map(([toolUsed, v]) => ({ toolUsed, count: v.count, types: v.types }))
    .sort((a, b) => b.count - a.count);

  // ── funnel：可派生的全部来自 LanguageIntent；未埋点项 null + gaps ──
  const countWhere = (fn: (r: (typeof rows)[number]) => boolean) => rows.filter(fn).length;
  const funnel = {
    entered: events,
    asked: countWhere((r) => ['meaning', 'hidden_meaning', 'speak'].includes(r.intent)),
    didReadContent: countWhere((r) => r.contentMatch === 'exact' || r.contentMatch === 'partial'),
    didAsk: countWhere((r) => r.source === 'ask'),
    didTranslate: countWhere((r) => r.intent === 'translate'),
    didSpeak: countWhere((r) => r.intent === 'speak'),
    didVoice: countWhere((r) => r.toolUsed === 'voice' || r.toolType === 'voice'),
    didArena: countWhere((r) => r.toolUsed === 'arena' || r.toolType === 'arena' || r.channel === 'arena'),
    // 以下四项全仓无写入调用点（字段存在但数据恒缺）→ null，不得显示为 0
    signup: null as number | null,
    firstTranslation: null as number | null,
    creditConsumed: null as number | null,
    payment: null as number | null,
  };

  const gaps = [
    'signup：LanguageIntent.signup 与 ContentMetrics.signups 字段存在，但全仓无写入调用点（本轮不回填）→ 返回 null，不代表 0 转化',
    'first_translation：同上，无调用点 → null',
    'credit_consume：同上，无调用点 → null',
    'payment：无对应埋点表/事件，完全未采集 → null',
    `SEO 指标（impressions/clicks/ctr/avgPosition）：请从 GSC / Bing 站长 / 百度站长导出，本接口不生成近似值`,
  ];

  // ── ContentMetrics 聚合：内容页浏览 → 工具点击 CTR ──
  const cmAgg = await prisma.contentMetrics
    .aggregate({
      where: { date: { gte: from, lte: to } },
      _sum: { pageviews: true, toolClicks: true },
    })
    .catch(() => null);
  const contentPageviews = cmAgg?._sum.pageviews ?? 0;
  const toolClicks = cmAgg?._sum.toolClicks ?? 0;
  const contentToToolCtr = {
    contentPageviews,
    toolClicks,
    ctr: contentPageviews >= MIN_SAMPLE ? round4(toolClicks / contentPageviews) : null,
  };

  const uniqueNormalized = new Set(
    rows.map((r) => r.normalizedQuery).filter((q) => q && q !== '[redacted]')
  ).size;

  return NextResponse.json({
    ok: true,
    days,
    range: { from: from.toISOString(), to: to.toISOString() },
    sample: { events, uniqueNormalized, sufficient },
    byIntent,
    bySource,
    byChannel,
    byTool,
    funnel,
    gaps,
    seo: {
      indexedPages: null,
      impressions: null,
      clicks: null,
      ctr: null,
      avgPosition: null,
      note: 'SEO 数据来自 GSC / Bing 站长 / 百度站长，本接口不生成近似值',
    },
    contentToToolCtr,
    dataQuality: {
      zeroShareReason: sufficient
        ? null
        : `样本不足（events=${events} < ${MIN_SAMPLE}）：所有 share 与占比类字段返回 null，避免用 0% 冒充真实占比；请先累积足够事件再解读`,
      contentToToolCtrNote:
        contentPageviews >= MIN_SAMPLE ? null : `内容页浏览样本不足（pageviews=${contentPageviews} < ${MIN_SAMPLE}）→ ctr 返回 null`,
      untrackedFunnelSteps: ['signup', 'firstTranslation', 'creditConsumed', 'payment'],
    },
  });
}
