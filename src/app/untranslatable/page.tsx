import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { spStr, spPage } from '@/lib/content/sp-param';

export const dynamic = 'force-dynamic';

const metadataBase = {
  title: '难翻译词 · 无法直译的外语词 | 爱翻译',
  description: '难翻译词栏目：各国无法直译却精准表达心情的外语词——日语、韩语、德语、法语……一个词，一段故事。',
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilter = !!(spStr(sp.q) || spPage(sp.page) > 1);
  return { ...metadataBase, robots: hasFilter ? { index: false, follow: true } : undefined };
}

const PAGE_SIZE = 48;

export default async function UntranslatableIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = spStr(sp.q).slice(0, 64);
  const page = spPage(sp.page);

  const where: any = {
    status: 'published',
    type: 'untranslatable',
    ...(q
      ? {
          OR: [
            { term: { contains: q } },
            { meaning: { contains: q } },
            { translation: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items, hot] = await Promise.all([
    prisma.expressionEntry.count({ where }).catch(() => 0),
    prisma.expressionEntry
      .findMany({
        where,
        orderBy: [{ popularity: 'desc' }, { term: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { slug: true, term: true, lang: true, meaning: true, translation: true },
      })
      .catch(() => []),
    !q
      ? prisma.expressionEntry
          .findMany({
            where: { status: 'published', type: 'untranslatable' },
            orderBy: { popularity: 'desc' },
            take: 10,
            select: { slug: true, term: true, lang: true, translation: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const href = (extra: { q?: string; page?: string }) => {
    const usp = new URLSearchParams();
    const qq = extra.q !== undefined ? extra.q : q;
    const pp = extra.page !== undefined ? extra.page : '';
    if (qq) usp.set('q', qq);
    if (pp) usp.set('page', pp);
    const s = usp.toString();
    return s ? `/untranslatable?${s}` : '/untranslatable';
  };

  const cards = [
    { href: '/idioms', title: '成语谚语', desc: '中国成语地道英文' },
    { href: '/meme', title: '网络用语', desc: '各国网络热梗翻译' },
    { href: '/travel', title: '旅行语言', desc: '出国场景表达' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>难翻译词</h1>
        <p>无法直译却精准表达心情的外语词——一个词，一段故事</p>
        <form className="search-box" action="/untranslatable" method="get">
          <input type="search" name="q" placeholder="搜索：hygge / 积ん読 / saudade…" defaultValue={q} />
          <button type="submit" className="primary">搜索</button>
          {q && <a className="clear-link" href="/untranslatable">清除</a>}
        </form>
      </section>

      {!q && (
        <>
          <h2 className="section-title">热门难翻译词 TOP10</h2>
          <div className="entry-grid">
            {hot.map((e) => (
              <Link key={e.slug} className="entry-card" href={`/untranslatable/${e.slug}`}>
                <div className="term">{e.term}</div>
                <div className="tr">{e.translation}</div>
                <div className="mn">{e.lang || ''}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录难翻译词（{total}）</h2>
          <div className="entry-grid">
            {items.map((e) => (
              <Link key={e.slug} className="entry-card" href={`/untranslatable/${e.slug}`}>
                <div className="term">{e.term}</div>
                <div className="tr">{e.translation}</div>
                <div className="mn">{e.meaning}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {items.length === 0 && (page > totalPages ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          当前页超出范围（共 {totalPages} 页），<Link href={href({ page: String(totalPages) })} style={{ color: 'var(--accent2)' }}>查看最后一页</Link>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          没有找到匹配的难翻译词，换个关键词试试？
        </div>
      ))}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, safePage - 3), safePage + 2)
            .map((p) => (
              <Link key={p} className={p === safePage ? 'page page-active' : 'page'} href={href({ page: String(p) })}>
                {p}
              </Link>
            ))}
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: 32 }}>相关栏目</h2>
      <div className="entry-grid">
        {cards.map((c) => (
          <Link key={c.href} className="entry-card" href={c.href}>
            <div className="term">{c.title}</div>
            <div className="mn">{c.desc}</div>
          </Link>
        ))}
      </div>
      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>难翻译词内容按批次建设中——先试试 AI 翻译工具。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
