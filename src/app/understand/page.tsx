import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { getTrendingMemes } from '@/lib/metrics/trending';
import AskAifanyi from '@/components/AskAifanyi';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  path: '/understand',
  title: '看懂语言 · 网络用语/成语/难翻译词/俚语是什么意思 | 爱翻译',
  description: '看懂语言的频道：网络用语、成语谚语、难翻译词、俚语与流行表达的含义、语境与地道翻译。一个词一个世界，爱翻译帮你真正听懂。',
  keywords: ['网络用语是什么意思', '成语英文', '难翻译词', '俚语含义', '看懂语言'],
  ogType: 'list',
});

const INTRO = '「看懂语言」是爱翻译的内容词典区：不只会给译文，更讲清一个词背后的语境、文化与情绪。网络热梗有圈层黑话，成语谚语有千年典故，难翻译词藏着别国的生活哲学——查词义、看例句、学用法，再顺手把整句话翻成地道表达。词典按类目组织，下面是全部分类与当前热门词条。';

export default async function UnderstandHub() {
  // 各栏目录数 + 类目导航 + 热门 TOP20（Trending V1：编辑热度 70% + 近 7 天访问 30%）
  let counts = { meme: 0, idiom: 0, untranslatable: 0, expression: 0, phrase: 0 };
  try {
    const [m, i, u, e, p] = await Promise.all([
      prisma.memeEntry.count({ where: { status: 'published' } }),
      prisma.expressionEntry.count({ where: { status: 'published', type: 'idiom' } }),
      prisma.expressionEntry.count({ where: { status: 'published', type: 'untranslatable' } }),
      prisma.expressionEntry.count({ where: { status: 'published' } }),
      prisma.phraseEntry.count({ where: { status: 'published' } }),
    ]);
    counts = { meme: m, idiom: i, untranslatable: u, expression: e, phrase: p };
  } catch {}

  const lines = [
    { href: '/meme', ico: '🔥', name: '网络用语与俚语', desc: '热梗 · 缩写 · 黑话——中文互联网的每一句潜台词', count: counts.meme },
    { href: '/understand/say', ico: '🗣️', name: '怎么说 · 高频词双语词典', desc: '中→英、英→中双向：每个高频词一页，快答 + 例句 + 相关表达', count: counts.phrase },
    { href: '/untranslatable', ico: '🧩', name: '难翻译词词典', desc: 'komorebi · wabi-sabi——那些英语里找不到对应词的世界', count: counts.untranslatable },
    { href: '/idioms', ico: '📜', name: '成语谚语翻译', desc: '画蛇添足 · 亡羊补牢——四字里的千年智慧怎么翻', count: counts.idiom },
    { href: '/understand/meaning', ico: '💬', name: '词义快答', desc: '一句话快答：这个词到底什么意思、怎么用', count: 0 },
  ];

  // __p0hub__ 类目导航：MemeEntry tags GROUP BY 取前 18 类 × 每类 3 个代表词直链
  let tagList: { tag: string; cnt: number }[] = [];
  let pool: { slug: string; term: string; translation: string; lang: string; tags: string[] }[] = [];
  let hot: Awaited<ReturnType<typeof getTrendingMemes>> = [];
  try {
    const [tagRows, poolRows, trending] = await Promise.all([
      prisma.$queryRaw<{ tag: string; cnt: bigint }[]>`
        SELECT unnest(tags) AS tag, count(*) AS cnt FROM "MemeEntry" WHERE status = 'published' GROUP BY 1 ORDER BY 2 DESC LIMIT 18
      `,
      prisma.memeEntry.findMany({
        where: { status: 'published' },
        orderBy: { popularity: 'desc' },
        take: 240,
        select: { slug: true, term: true, translation: true, lang: true, tags: true },
      }),
      getTrendingMemes(20),
    ]);
    tagList = tagRows.map((t) => ({ tag: t.tag, cnt: Number(t.cnt) }));
    pool = poolRows;
    hot = trending;
  } catch {}

  // 每类 3 个代表词（按 popularity 池顺序取首个命中该 tag 的词条）
  const catNav = tagList.map(({ tag, cnt }) => {
    const reps = pool.filter((p) => p.tags.includes(tag)).slice(0, 3);
    return { tag, cnt, reps };
  }).filter((c) => c.reps.length > 0);

  const memeUrl = (lang: string, slug: string) => (lang === 'en' ? '/understand/meaning/' : '/meme/') + slug;

  const itemListLd = hot.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '看懂语言 · 热门词条 TOP20',
    itemListElement: hot.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.term,
      url: SITE_URL + memeUrl(m.lang || 'zh-CN', m.slug),
    })),
  } : null;

  return (
    <div className="container">
      <section className="hero">
        <h1>看懂语言</h1>
        <p>不只是翻译——理解每个词背后的语境、文化与情绪。{counts.expression + counts.meme + counts.phrase}+ 词条持续更新。</p>
      </section>

      <p style={{ maxWidth: 720, margin: '0 auto 8px', color: 'var(--fg, inherit)' }}>{INTRO}</p>

      <AskAifanyi
        hints={['cringe 是什么意思？', 'yyds 是什么意思？', 'wabi-sabi 是什么意思？']}
        placeholder="Ask AIFANYI：这个词是什么意思？"
      />

      <div className="entry-grid">
        {lines.map((l) => (
          <Link key={l.href} className="entry-card" href={l.href}>
            <div className="term">{l.ico} {l.name}{l.count > 0 && <span className="ud-count">{l.count}</span>}</div>
            <div className="tr">{l.desc}</div>
          </Link>
        ))}
      </div>

      {/* __p0hub__ 类目导航（18 类 × 3 代表词） */}
      {catNav.length > 0 && (
        <>
          <h2 className="section-title">按类目浏览</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {catNav.map((c) => (
              <div key={c.tag} className="entry-card" style={{ cursor: 'default' }}>
                <div className="term">
                  <Link href={'/meme/tag/' + encodeURIComponent(c.tag)}>{c.tag}</Link>
                  <span className="chip-cnt">{c.cnt}</span>
                </div>
                <div className="tr">
                  {c.reps.map((r, i) => (
                    <span key={r.slug}>
                      {i > 0 && ' · '}
                      <Link href={memeUrl(r.lang, r.slug)}>{r.term}</Link>
                    </span>
                  ))}
                  <span>
                    {' · '}
                    <Link href={'/meme/tag/' + encodeURIComponent(c.tag)}>更多 →</Link>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* __p0hub__ 热门 TOP20 + ItemList schema */}
      {hot.length > 0 && (
        <>
          {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
          <h2 className="section-title">🔥 热门词条 TOP20</h2>
          <div className="entry-grid">
            {hot.map((m) => (
              <Link key={m.slug} className="entry-card" href={memeUrl(m.lang || 'zh-CN', m.slug)}>
                <div className="term">{m.term}</div>
                <div className="tr">{m.translation}</div>
                <div className="mn">{m.meaning}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>想查的词这里没有？直接问 AI——把整句话丢进翻译框，看三种模型怎么理解。</p>
        <a href="/" className="btn primary">去问 AI →</a>
      </div>
    </div>
  );
}
