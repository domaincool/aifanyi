import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '网络用语翻译大全 · 网络用语英文怎么说 | 爱翻译',
  description: '网络热梗地道英文翻译大全：职场、恋爱、游戏、影视、网络用语全覆盖。YYDS、破防、班味、情绪价值……一句中文梗，一句地道英文。',
  keywords: ['网络用语英文', '网络流行语翻译', '网络热梗翻译'],
};

const PAGE_SIZE = 48;

export default async function MemeIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const tag = (sp.tag ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: any = {
    status: 'published',
    ...(q
      ? {
          OR: [
            { term: { contains: q } },
            { meaning: { contains: q } },
            { translation: { contains: q } },
          ],
        }
      : {}),
    ...(tag ? { tags: { has: tag } } : {}),
  };

  const [total, memes, hotMemes, tags] = await Promise.all([
    prisma.memeEntry.count({ where }),
    prisma.memeEntry.findMany({
      where,
      orderBy: [{ popularity: 'desc' }, { term: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.memeEntry.findMany({ where: { status: 'published' }, orderBy: { popularity: 'desc' }, take: 10 }),
    prisma.$queryRaw<{ tag: string; cnt: bigint }[]>`
      SELECT unnest(tags) AS tag, count(*) AS cnt FROM "MemeEntry" WHERE status = 'published' GROUP BY 1 ORDER BY 2 DESC
    `,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tagList = tags.map((t) => ({ tag: t.tag, cnt: Number(t.cnt) }));

  const href = (extra: { q?: string; tag?: string; page?: string }) => {
    const usp = new URLSearchParams();
    const qq = extra.q !== undefined ? extra.q : q;
    const tt = extra.tag !== undefined ? extra.tag : tag;
    const pp = extra.page !== undefined ? extra.page : '';
    if (qq) usp.set('q', qq);
    if (tt) usp.set('tag', tt);
    if (pp) usp.set('page', pp);
    const s = usp.toString();
    return s ? `/meme?${s}` : '/meme';
  };

  return (
    <div>
      {/* 顶部 */}
      <section className="hero">
        <h1>网络用语翻译大全</h1>
        <p>一句中文梗，一句地道英文 —— {total} 个网络热梗等你来翻</p>
        <form className="search-box" action="/meme" method="get">
          <input type="search" name="q" placeholder="搜梗：YYDS / 破防 / 班味 / 情绪价值…" defaultValue={q} />
          <button type="submit" className="primary">搜索</button>
          {q && <a className="clear-link" href="/meme">清除</a>}
        </form>
      </section>

      {/* 分类 chips */}
      <div className="chips">
        <Link className={!tag ? 'chip chip-active' : 'chip'} href={href({ tag: '' })}>全部</Link>
        {tagList.slice(0, 24).map((t) => (
          <Link key={t.tag} className={tag === t.tag ? 'chip chip-active' : 'chip'} href={'/meme/tag/' + encodeURIComponent(t.tag)}>
            {t.tag} <span className="chip-cnt">{t.cnt}</span>
          </Link>
        ))}
      </div>

      {/* 热梗榜（无筛选时展示） */}
      {!q && !tag && (
        <>
          <h2 className="section-title">🔥 热梗榜 TOP10</h2>
          <div className="entry-grid">
            {hotMemes.map((m) => (
              <Link key={m.slug} className="entry-card" href={`/meme/${m.slug}`}>
                <div className="term">{m.term}</div>
                <div className="tr">{m.translation}</div>
                <div className="mn">{m.meaning}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 词条列表 */}
      <h2 className="section-title">
        {q ? `搜索结果：${total} 条` : tag ? `「${tag}」分类：${total} 条` : `全部网络用语翻译（${total} 条）`}
      </h2>
      {memes.length > 0 ? (
        <div className="entry-grid">
          {memes.map((m) => (
            <Link key={m.slug} className="entry-card" href={`/meme/${m.slug}`}>
              <div className="term">{m.term}</div>
              <div className="tr">{m.translation}</div>
              <div className="mn">{m.meaning}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>没有找到相关网络用语翻译</p>
          <p className="empty-sub">换个关键词试试，或<a href="/meme">浏览全部</a></p>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <nav className="pagination">
          {page > 1 && <Link className="page-btn" href={href({ page: String(page - 1) })}>← 上一页</Link>}
          <span className="page-info">第 {page} / {totalPages} 页</span>
          {page < totalPages && <Link className="page-btn" href={href({ page: String(page + 1) })}>下一页 →</Link>}
        </nav>
      )}
    </div>
  );
}