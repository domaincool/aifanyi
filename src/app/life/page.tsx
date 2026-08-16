import { prisma } from '@/lib/db';
import Link from 'next/link';
import { countryName } from '@/lib/content/locales';

export const revalidate = 300;

export const metadata = {
  title: '海外生活 · 移居留学场景表达 | 爱翻译',
  description: '海外生活栏目：租房、求职、看病、子女上学等移居留学场景常用语对照——日本、韩国、泰国、法国……',
};

const PAGE_SIZE = 48;

export default async function LifeIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const country = (sp.country ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: any = {
    status: 'published',
    kind: 'life',
    ...(country ? { country } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { intro: { contains: q } },
            { scene: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, items, countries] = await Promise.all([
    prisma.sceneEntry.count({ where }).catch(() => 0),
    prisma.sceneEntry
      .findMany({
        where,
        orderBy: [{ popularity: 'desc' }, { title: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { slug: true, country: true, title: true, intro: true, scene: true, kind: true },
      })
      .catch(() => []),
    prisma.$queryRaw<{ country: string; cnt: bigint }[]>`
      SELECT country, count(*) AS cnt FROM "SceneEntry" WHERE status = 'published' AND kind = 'life' GROUP BY country ORDER BY 2 DESC
    `.catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countryList = countries.map((c) => ({ country: c.country, cnt: Number(c.cnt) }));

  const href = (extra: { q?: string; country?: string; page?: string }) => {
    const usp = new URLSearchParams();
    const qq = extra.q !== undefined ? extra.q : q;
    const cc = extra.country !== undefined ? extra.country : country;
    const pp = extra.page !== undefined ? extra.page : '';
    if (qq) usp.set('q', qq);
    if (cc) usp.set('country', cc);
    if (pp) usp.set('page', pp);
    const s = usp.toString();
    return s ? `/life?${s}` : '/life';
  };

  const cards = [
    { href: '/travel', title: '旅行语言', desc: '出国场景表达' },
    { href: '/tools/web-translator', title: '网页翻译', desc: '外文租房/办事页面翻译' },
    { href: '/tools/doc-translator', title: 'Word/PPT 翻译', desc: '合同/材料文档翻译' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>海外生活</h1>
        <p>移居留学场景表达——租房、求职、看病、上学，稳稳落地</p>
        <form className="search-box" action="/life" method="get">
          <input type="search" name="q" placeholder="搜索场景：租房 / 求职 / 看病…" defaultValue={q} />
          <button type="submit" className="primary">搜索</button>
          {q && <a className="clear-link" href="/life">清除</a>}
        </form>
      </section>

      <div className="chips">
        <Link className={!country ? 'chip chip-active' : 'chip'} href={href({ country: '' })}>全部</Link>
        {countryList.map((c) => (
          <Link key={c.country} className={country === c.country ? 'chip chip-active' : 'chip'} href={href({ country: c.country })}>
            {countryName(c.country)} <span className="chip-cnt">{c.cnt}</span>
          </Link>
        ))}
      </div>

      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录生活场景（{total}）</h2>
          <div className="entry-grid">
            {items.map((s) => (
              <Link key={s.slug} className="entry-card" href={`/travel/${s.country}/${s.slug}`}>
                <div className="term">{s.title}</div>
                <div className="tr">{countryName(s.country)}</div>
                <div className="mn">{s.intro}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          海外生活场景内容按批次建设中，敬请期待——先看看<a href="/travel" style={{ color: 'var(--accent2)' }}>旅行语言</a>？
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
        <p>海外生活内容按批次建设中——先试试 AI 翻译工具。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
