import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { spStr, spPage } from '@/lib/content/sp-param';

export const dynamic = 'force-dynamic';

const metadataBase = {
  title: '成语谚语翻译大全 · 成语英语怎么说 | 爱翻译',
  description: '中国成语谚语地道英文翻译大全：画蛇添足、亡羊补牢、守株待兔、破釜沉舟……一句成语，一句地道英文。含拼音、直译、例句与出处。',
  keywords: ['成语翻译', '成语英语怎么说', '谚语翻译', '成语英文', '画蛇添足英文'],
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilter = !!(spStr(sp.q) || spStr(sp.tag) || spPage(sp.page) > 1);
  return { ...metadataBase, robots: hasFilter ? { index: false, follow: true } : undefined };
}

const PAGE_SIZE = 48;

export default async function IdiomsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = spStr(sp.q).slice(0, 64);
  const tag = spStr(sp.tag);
  const page = spPage(sp.page);

  const where: any = {
    status: 'published',
    type: 'idiom',
    ...(q
      ? {
          OR: [
            { term: { contains: q } },
            { meaning: { contains: q } },
            { translation: { contains: q, mode: 'insensitive' } },
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
  const safePage = Math.min(page, totalPages);
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

      {idioms.length === 0 && (page > totalPages ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          当前页超出范围（共 {totalPages} 页），<Link href={href({ page: String(totalPages) })} style={{ color: 'var(--accent2)' }}>查看最后一页</Link>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          没有找到匹配的成语谚语，换个关键词试试？
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
        {[
          { href: '/meme', title: '网络用语', desc: '各国网络热梗翻译' },
          { href: '/untranslatable', title: '难翻译词', desc: '无法直译却精准表达心情的词' },
          { href: '/expressions', title: '地道表达', desc: '实用表达合集' },
          { href: '/menu', title: '菜单词典', desc: '各国菜单菜名翻译' },
          { href: '/travel', title: '旅行语言', desc: '出国场景表达' },
          { href: '/life', title: '海外生活', desc: '移居留学场景表达' },
        ].map((c2) => (
          <Link key={c2.href} className="entry-card" href={c2.href}>
            <div className="term">{c2.title}</div>
            <div className="mn">{c2.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
