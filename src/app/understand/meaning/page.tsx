import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { recordSearchQuery } from '@/lib/metrics/server';

export const dynamic = 'force-dynamic';

/** 搜索问句归一化：剥疑问后缀与尾标点，避免整句 LIKE 零结果（零结果词复盘 2026-09-11） */
function normalizeQuery(raw: string): string {
  const base = raw.trim();
  if (!base) return base;
  const stripped = base
    .replace(/[?？!！。，,.]+$/g, '')
    .replace(/(是什么意思|啥意思|什么意思|什么梗|啥梗|怎么说|怎么讲|怎么表达|如何表达|用英语怎么说|用英文怎么说|英语怎么说|英文怎么说)$/g, '')
    .replace(/[?？!！。，,.]+$/g, '')
    .trim();
  const picked = stripped.length >= 2 ? stripped : base;
  return picked.slice(0, 64);
}

/**
 * XX 是什么意思 · 搜索快答入口（蓝图 5.6 + P2 裁决）
 * - 无 q 参数：可索引的栏目入口页（快答榜单）
 * - 有 q 参数：noindex,follow 的搜索结果页（P2 硬规则：不进 sitemap、不计内容 KPI）
 *   - 精确命中单词条 → 服务端直接渲染该词条快答（后续升级为跳转稳定 [slug] URL）
 *   - 多条命中 → 分组结果列表
 *   - 零命中 → AI 兜底三按钮（spec §55）
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  if (!q) {
    return buildMetadata({
      path: '/understand/meaning',
      title: 'XX 是什么意思 · 一句话快答 | 爱翻译',
      description: '输入任何词或短语，AI 告诉你它是什么意思、怎么用、怎么翻。网络用语、俚语、成语、难翻译词一站快答。',
      keywords: ['什么意思', '词义查询', '快答'],
      ogType: 'list',
    });
  }
  // P2 硬规则：搜索参数页 noindex
  return buildMetadata({
    path: '/understand/meaning',
    title: `${q} 是什么意思？| 爱翻译`,
    description: `${q} 的含义快答与相关词条。`,
    ogType: 'list',
    noindex: true,
  });
}

export default async function MeaningSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = normalizeQuery((sp.q ?? '').slice(0, 128));

  // 无查询：渲染热门词条榜（可索引入口）
  if (!q) {
    const hot = await prisma.memeEntry.findMany({
      where: { status: 'published' },
      orderBy: { popularity: 'desc' },
      take: 12,
      select: { slug: true, term: true, meaning: true, translation: true, lang: true }, // __p0mlink-meaning2__
    }).catch(() => []);
    return (
      <div className="container">
        <section className="hero">
          <h1>XX 是什么意思？</h1>
          <p>输入一个词、一句梗、一条缩写——马上得到一句话答案。</p>
        </section>
        <form className="filter-bar" action="/understand/meaning" method="get">
          <input type="search" name="q" placeholder="如：cringe / yyds / I need some space" autoFocus />
          <button type="submit" className="btn primary">快答</button>
        </form>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: hot.map((m, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITE_URL}/meme/${m.slug}`,
                name: m.term,
              })),
            }),
          }}
        />
        <h2 className="section-title">大家都在查</h2>
        <div className="entry-grid">
          {hot.map((m) => (
            <Link key={m.slug} className="entry-card" href={m.lang === 'en' ? `/understand/meaning/${m.slug}` : `/meme/${m.slug}`}> // __p0mlink__
              <div className="term">{m.term}</div>
              <div className="tr">{m.translation}</div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // 有查询：五表搜索（term/meaning/translation LIKE，限量）
  const like = { contains: q, mode: 'insensitive' as const };
  const [memes, exprs, scenes, menus, recipes] = await Promise.all([
    prisma.memeEntry.findMany({
      where: { status: 'published', OR: [{ term: like }, { meaning: like }, { translation: like }] },
      orderBy: { popularity: 'desc' },
      take: 10,
      select: { slug: true, term: true, meaning: true, translation: true, shortAnswer: true, lang: true }, // __p0mlink-meaning3__
    }).catch(() => []),
    prisma.expressionEntry.findMany({
      where: { status: 'published', OR: [{ term: like }, { meaning: like }, { translation: like }] },
      orderBy: { popularity: 'desc' },
      take: 10,
      select: { slug: true, type: true, term: true, meaning: true, translation: true, shortAnswer: true },
    }).catch(() => []),
    // 蓝图 5.6：五表全覆盖（场景/菜单/食谱，IA-10 P1 收尾）
    prisma.sceneEntry.findMany({
      where: { status: 'published', OR: [{ title: like }, { intro: like }, { scene: like }] },
      orderBy: { popularity: 'desc' },
      take: 6,
      select: { slug: true, country: true, kind: true, title: true, intro: true },
    }).catch(() => []),
    prisma.menuEntry.findMany({
      where: { status: 'published', OR: [{ dish: like }, { zh: like }, { en: like }, { description: like }] },
      orderBy: { popularity: 'desc' },
      take: 6,
      select: { slug: true, country: true, dish: true, zh: true, en: true, shortAnswer: true },
    }).catch(() => []),
    prisma.recipeEntry.findMany({
      where: { status: 'published', OR: [{ dish: like }, { zhName: like }, { enName: like }, { intro: like }] },
      orderBy: { popularity: 'desc' },
      take: 6,
      select: { slug: true, dish: true, zhName: true, enName: true, shortAnswer: true, intro: true },
    }).catch(() => []),
  ] as const);

  const resultCount = memes.length + exprs.length + scenes.length + menus.length + recipes.length;
  // P2 四字段日志（search_query / search_count / zero_result / ai_answer_used 占位 false）
  recordSearchQuery(q, resultCount, false).catch(() => {});

  // 精确命中单条：term === q 优先展示快答卡
  const memeExact = memes.find((m) => m.term.toLowerCase() === q.toLowerCase());
  const exprExact = exprs.find((e) => e.term.toLowerCase() === q.toLowerCase());
  const exact = memeExact ?? exprExact;
  const exactHref = memeExact
    ? `/meme/${memeExact.slug}`
    : exprExact
      ? (exprExact.type === 'idiom' ? `/idioms/${exprExact.slug}` : `/untranslatable/${exprExact.slug}`)
      : null;

  return (
    <div className="container">
      <section className="hero">
        <h1>{q} 是什么意思？</h1>
      </section>

      {exact ? (
        <div className="translator-box" style={{ maxWidth: 'none' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>一句话答案</div>
          <div style={{ fontSize: 20, fontWeight: 600, margin: '8px 0' }}>
            {(exact as any).shortAnswer || `${exact.term}（${exact.meaning}）→ ${exact.translation}`}
          </div>
          {exactHref && (
            <Link href={exactHref} className="btn" style={{ marginTop: 8 }}>
              查看完整词条 →
            </Link>
          )}
        </div>
      ) : resultCount > 0 ? (
        <>
          <p style={{ color: 'var(--muted)' }}>找到 {resultCount} 条相关内容：</p>
          <div className="entry-grid">
            {memes.map((m) => (
              <Link key={m.slug} className="entry-card" href={`/meme/${m.slug}`}>
                <div className="term">{m.term}</div>
                <div className="tr">{(m.shortAnswer as string) || m.translation}</div>
              </Link>
            ))}
            {exprs.map((e) => (
              <Link key={e.slug} className="entry-card" href={e.type === 'idiom' ? `/idioms/${e.slug}` : `/untranslatable/${e.slug}`}>
                <div className="term">{e.term}</div>
                <div className="tr">{(e.shortAnswer as string) || e.translation}</div>
              </Link>
            ))}
          </div>
          {(scenes.length > 0 || menus.length > 0 || recipes.length > 0) && (
            <div className="entry-grid" style={{ marginTop: 12 }}>
              {scenes.map((sc) => (
                <Link
                  key={sc.slug}
                  className="entry-card"
                  href={sc.kind === 'life' ? `/life/${sc.country}/${sc.slug}` : `/travel/${sc.country}/${sc.slug}`}
                >
                  <div className="term">{sc.title}</div>
                  <div className="tr">{sc.intro.slice(0, 50)}</div>
                </Link>
              ))}
              {menus.map((m) => (
                <Link key={m.slug} className="entry-card" href={`/menu/${m.country}/${m.slug}`}>
                  <div className="term">{m.zh} · {m.dish}</div>
                  <div className="tr">{(m.shortAnswer as string) || m.en || ''}</div>
                </Link>
              ))}
              {recipes.map((r) => (
                <Link key={r.slug} className="entry-card" href={`/recipes/${r.slug}`}>
                  <div className="term">{r.zhName || r.dish}</div>
                  <div className="tr">{(r.shortAnswer as string) || (r.intro ?? '').slice(0, 50)}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="cta-box">
          <p>没有找到完全匹配的内容。AI 可以帮你：</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a className="btn primary" href={`/?ai_meaning=${encodeURIComponent(q)}`}>解释这个词</a>
            <a className="btn" href={`/?q=${encodeURIComponent(q)}`}>翻译这句话</a>
            <a className="btn" href={`/?polish=${encodeURIComponent(q)}`}>生成自然表达</a>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <form className="filter-bar" action="/understand/meaning" method="get">
          <input type="search" name="q" defaultValue={q} placeholder="再查一个词" />
          <button type="submit" className="btn primary">快答</button>
        </form>
      </div>
    </div>
  );
}
