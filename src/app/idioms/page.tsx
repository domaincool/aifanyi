import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '成语谚语翻译大全 · 成语英语怎么说 | 爱翻译',
  description: '中国成语谚语地道英文翻译大全：画蛇添足、亡羊补牢、守株待兔、破釜沉舟……一句成语，一句地道英文。含拼音、直译、例句与出处。',
  keywords: ['成语翻译', '成语英语怎么说', '谚语翻译', '成语英文', '画蛇添足英文'],
};

const PAGE_SIZE = 48;

export default async function IdiomsIndexPage({
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
    type: 'idiom',
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

  const [total, idioms, hot, tags] = await Promise.all([
    prisma.expressionEntry.count({ where }),
    prisma.expressionEntry.findMany({
      where,
      orderBy: [{ popularity: 'desc' }, { term: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { slug: true, term: true, pinyin: true, meaning: true, translation: true, tags: true },
    }),
    prisma.expressionEntry.findMany({
      where: { status: 'published', type: 'idiom' },
      orderBy: { popularity: 'desc' },
      take: 10,
      select: { slug: true, term: true, translation: true },
    }),
    prisma.$queryRaw<{ tag: string; cnt: bigint }[]>`
      SELECT unnest(tags) AS tag, count(*) AS cnt FROM "ExpressionEntry" WHERE status = 'published' AND type = 'idiom' GROUP BY 1 ORDER BY 2 DESC
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
    return s ? `/idioms?${s}` : '/idioms';
  };

  return (
    <div>
      <section className="hero">
        <h1>成语谚语翻译大全</h1>
        <p>一句成语，一句地道英文——{total} 个成语谚语等你来翻</p>
        <form className="search-box" action="/idioms" method="get">
          <input type="search" name="q" placeholder="搜索：画蛇添足 / 亡羊补牢 / 破釜沉舟…" defaultValue={q} />
          <button type="submit" className="primary">搜索</button>
          {q && <a className="clear-link" href="/idioms">清除</a>}
        </form>
      </section>

      <div className="chips">
        <Link className={!tag ? 'chip chip-active' : 'chip'} href={href({ tag: '' })}>全部</Link>
        {tagList.slice(0, 24).map((t) => (
          <Link key={t.tag} className={tag === t.tag ? 'chip chip-active' : 'chip'} href={href({ tag: t.tag })}>
            {t.tag} <span className="chip-cnt">{t.cnt}</span>
          </Link>
        ))}
      </div>

      {!q && !tag && (
        <>
          <h2 className="section-title">热门成语 TOP10</h2>
          <div className="entry-grid">
            {hot.map((m) => (
              <Link key={m.slug} className="entry-card" href={`/idioms/${m.slug}`}>
                <div className="term">{m.term}</div>
                <div className="tr">{m.translation}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="entry-grid">
        {idioms.map((m) => (
          <Link key={m.slug} className="entry-card" href={`/idioms/${m.slug}`}>
            <div className="term">{m.term}</div>
            <div className="tr">{m.translation}</div>
            <div className="mn">{m.meaning}</div>
          </Link>
        ))}
      </div>

      {idioms.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          没有找到匹配的成语谚语，换个关键词试试？
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, page - 3), page + 2)
            .map((p) => (
              <Link key={p} className={p === page ? 'page page-active' : 'page'} href={href({ page: String(p) })}>
                {p}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
