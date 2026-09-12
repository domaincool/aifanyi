/**
 * 内容机会扫描（V1.1 P1-7）
 * 运行：npx tsx scripts/opportunity-scan.ts（在项目根目录）
 *
 * 职责边界：只读 LanguageIntent，只写 ContentOpportunity；status 恒为 candidate，
 * 绝不自动发布内容，也不触碰 MemeEntry / ExpressionEntry 等任何内容表。
 *
 * 四步算法：
 *  1) 归一化：对 normalizedQuery 再过一遍 normalizeQuery（兜底历史数据）
 *  2) 聚合：GROUP BY normalizedQuery + intent，HAVING count(*) >= 3（近 30 天）
 *  3) 相似聚类：可解释前缀启发式——中文取前 2 字、拉丁取前 4 字符分桶；桶内长度差 <= 6 视为同族；取众数为代表词
 *     （不使用 pg_trgm / embedding，零额外依赖、结果可人工复核）
 *  4) 覆盖判定：对代表词跑与 /understand/meaning 相同的五表检索（meme/expression/scene/menu/recipe）→ exact|partial|none
 *     score = hits * (covered ? 1.0 : 1.5)（未覆盖的缺口优先）
 *
 * 注意：tsx 独立运行不会自动加载 .env，这里手动解析后动态 require 模块
 */
import fs from 'fs';
import path from 'path';

// 1. 先加载 .env（必须在 require prisma 之前）
const envFile = path.join(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"\r\n]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  console.log('已加载 .env');
} else {
  console.warn('警告：未找到 .env，数据库连接可能失败');
}

// 2. 动态加载（env 就绪后再初始化）
const { prisma } = require('../src/lib/db');
const { normalizeQuery } = require('../src/lib/text/normalize-query');

const DAYS = 30;
const MIN_HITS = 3;
const MAX_LEN_GAP = 6;
const MAX_ROWS = 50000;

type Group = { intent: string; term: string; hits: number; variants: string[] };

/** 分桶键：中文取前 2 字、拉丁取前 4 字符（可解释前缀启发式） */
function bucketKey(intent: string, term: string): string {
  if (/^[\u4e00-\u9fff]/.test(term)) return `${intent}|zh:${term.slice(0, 2)}`;
  const latin = term.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  return `${intent}|la:${latin.slice(0, 4)}`;
}

/** 众数：hits 最高者；并列取长度短者（更接近「词」而非「句」） */
function modeOf(list: Group[]): Group {
  return [...list].sort((a, b) => b.hits - a.hits || a.term.length - b.term.length || a.term.localeCompare(b.term))[0];
}

/** 覆盖判定：与 /understand/meaning 相同的五表检索 */
async function coverage(term: string): Promise<{ covered: boolean; coveredBy: string | null; coverageKind: 'exact' | 'partial' | 'none' }> {
  const like = { contains: term, mode: 'insensitive' as const };
  const [memes, exprs, scenes, menus, recipes] = await Promise.all([
    prisma.memeEntry
      .findMany({
        where: { status: 'published', OR: [{ term: like }, { meaning: like }, { translation: like }] },
        orderBy: { popularity: 'desc' },
        take: 3,
        select: { slug: true, term: true },
      })
      .catch(() => []),
    prisma.expressionEntry
      .findMany({
        where: { status: 'published', OR: [{ term: like }, { meaning: like }, { translation: like }] },
        orderBy: { popularity: 'desc' },
        take: 3,
        select: { slug: true, term: true },
      })
      .catch(() => []),
    prisma.sceneEntry
      .findMany({
        where: { status: 'published', OR: [{ title: like }, { intro: like }, { scene: like }] },
        orderBy: { popularity: 'desc' },
        take: 3,
        select: { slug: true, title: true },
      })
      .catch(() => []),
    prisma.menuEntry
      .findMany({
        where: { status: 'published', OR: [{ dish: like }, { zh: like }, { en: like }, { description: like }] },
        orderBy: { popularity: 'desc' },
        take: 3,
        select: { slug: true, dish: true, zh: true, en: true },
      })
      .catch(() => []),
    prisma.recipeEntry
      .findMany({
        where: { status: 'published', OR: [{ dish: like }, { zhName: like }, { enName: like }, { intro: like }] },
        orderBy: { popularity: 'desc' },
        take: 3,
        select: { slug: true, dish: true, zhName: true, enName: true },
      })
      .catch(() => []),
  ]);

  const hits: { kind: string; id: string; keys: string[] }[] = [
    ...memes.map((m: { slug: string; term: string }) => ({ kind: 'meme', id: m.slug, keys: [m.term] })),
    ...exprs.map((e: { slug: string; term: string }) => ({ kind: 'expression', id: e.slug, keys: [e.term] })),
    ...scenes.map((s: { slug: string; title: string }) => ({ kind: 'scene', id: s.slug, keys: [s.title] })),
    ...menus.map((m: { slug: string; dish: string; zh: string | null; en: string | null }) => ({
      kind: 'menu',
      id: m.slug,
      keys: [m.dish, m.zh, m.en].filter(Boolean) as string[],
    })),
    ...recipes.map((r: { slug: string; dish: string; zhName: string | null; enName: string | null }) => ({
      kind: 'recipe',
      id: r.slug,
      keys: [r.dish, r.zhName, r.enName].filter(Boolean) as string[],
    })),
  ];

  const target = term.toLowerCase();
  const exact = hits.find((h) => h.keys.some((k) => String(k).trim().toLowerCase() === target));
  if (exact) return { covered: true, coveredBy: `${exact.kind}:${exact.id}`, coverageKind: 'exact' };
  if (hits.length) return { covered: true, coveredBy: `${hits[0].kind}:${hits[0].id}`, coverageKind: 'partial' };
  return { covered: false, coveredBy: null, coverageKind: 'none' };
}

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const batchId = new Date().toISOString().slice(0, 10);

  // ── Step 1：归一化（取近 30 天，排除脱敏行）──
  const raw = await prisma.languageIntent.findMany({
    where: { enteredAt: { gte: since }, NOT: { normalizedQuery: '[redacted]' } },
    select: { normalizedQuery: true, intent: true },
    take: MAX_ROWS,
  });

  const agg = new Map<string, Group>();
  const variantSeen = new Map<string, Set<string>>();
  for (const r of raw) {
    const term = normalizeQuery(String(r.normalizedQuery || ''));
    if (!term || term === '[redacted]') continue;
    const intent = String(r.intent || 'other');
    const key = `${intent}\u0000${term}`;
    const cur = agg.get(key) ?? { intent, term, hits: 0, variants: [] };
    cur.hits++;
    agg.set(key, cur);
    if (!variantSeen.has(key)) variantSeen.set(key, new Set());
    variantSeen.get(key)!.add(term);
  }

  // ── Step 2：HAVING count(*) >= 3 ──
  const groups = [...agg.entries()]
    .filter(([, g]) => g.hits >= MIN_HITS)
    .map(([key, g]) => ({ ...g, variants: [...(variantSeen.get(key) ?? new Set<string>())] }));

  if (!groups.length) {
    console.log(`近 ${DAYS} 天无满足 hits >= ${MIN_HITS} 的查询组（原始事件 ${raw.length} 条），未生成候选。`);
    return;
  }

  // ── Step 3：前缀启发式聚类（桶内按长度贪心分族，长度差 <= 6）──
  const buckets = new Map<string, Group[]>();
  for (const g of groups) {
    const k = bucketKey(g.intent, g.term);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(g);
  }

  const families: Group[][] = [];
  for (const list of buckets.values()) {
    list.sort((a, b) => a.term.length - b.term.length || a.term.localeCompare(b.term));
    let cur: Group[] = [];
    for (const g of list) {
      if (!cur.length) {
        cur = [g];
        continue;
      }
      if (g.term.length - cur[0].term.length <= MAX_LEN_GAP) cur.push(g);
      else {
        families.push(cur);
        cur = [g];
      }
    }
    if (cur.length) families.push(cur);
  }

  // ── Step 4：覆盖判定 + 幂等 upsert（status 恒 candidate）──
  const now = new Date();
  let created = 0;
  let updated = 0;
  for (const fam of families) {
    const rep = modeOf(fam);
    const intent = rep.intent;
    const variants = [...new Set(fam.flatMap((g) => g.variants))].sort();
    const hits = fam.reduce((s, g) => s + g.hits, 0);
    const cov = await coverage(rep.term);
    const score = Math.round(hits * (cov.covered ? 1.0 : 1.5));

    const existing = await prisma.contentOpportunity.findUnique({
      where: { candidateTerm_intent: { candidateTerm: rep.term, intent } },
    });
    if (existing) {
      await prisma.contentOpportunity.update({
        where: { id: existing.id },
        data: {
          hits: existing.hits + hits,
          lastSeenAt: now,
          variants,
          covered: cov.covered,
          coveredBy: cov.coveredBy,
          coverageKind: cov.coverageKind,
          score,
          status: 'candidate',
          batchId,
        },
      });
      updated++;
    } else {
      await prisma.contentOpportunity.create({
        data: {
          candidateTerm: rep.term,
          intent,
          variants,
          hits,
          covered: cov.covered,
          coveredBy: cov.coveredBy,
          coverageKind: cov.coverageKind,
          score,
          status: 'candidate',
          batchId,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      created++;
    }
    console.log(`  ${cov.covered ? '已覆盖' : '缺口 '} ${intent}/${rep.term}  hits=${hits} score=${score} variants=${variants.length}`);
  }

  console.log(`\n扫描完成：原始事件 ${raw.length} 条 → 达标组 ${groups.length} 个 → 候选家族 ${families.length} 个（新建 ${created} / 更新 ${updated}），batchId=${batchId}`);
  console.log('注意：候选仅入库待人工审核，status 恒为 candidate，绝不自动发布内容。');
}

main()
  .catch((e: unknown) => {
    console.error('扫描失败：', e);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect?.().catch?.(() => {});
  });
