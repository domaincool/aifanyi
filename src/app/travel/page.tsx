import { prisma } from '@/lib/db';
import Link from 'next/link';
import { countryName } from '@/lib/content/locales';
import type { Metadata } from 'next';
import { spStr, spPage } from '@/lib/content/sp-param';

export const dynamic = 'force-dynamic';

const metadataBase = {
  title: '旅行语言 · 出国场景常用语翻译 | 爱翻译',
  description: '旅行语言栏目：点餐、问路、住宿、购物等出国场景常用语对照——日本、韩国、泰国、法国、意大利……',
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilter = !!(spStr(sp.q) || spStr(sp.country) || spPage(sp.page) > 1);
  return { ...metadataBase, robots: hasFilter ? { index: false, follow: true } : undefined };
}

const PAGE_SIZE = 48;

export default async function TravelIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = spStr(sp.q).slice(0, 64);
  const country = spStr(sp.country);
  const page = spPage(sp.page);

  const where: any = {
    status: 'published',
    kind: 'travel',
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

  const [total, items, hot, countries] = await Promise.all([
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
    !q && !country
      ? prisma.sceneEntry
          .findMany({
            where: { status: 'published', kind: 'travel' },
            orderBy: { popularity: 'desc' },
            take: 10,
            select: { slug: true, country: true, title: true, intro: true, kind: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.$queryRaw<{ country: string; cnt: bigint }[]>`
      SELECT country, count(*) AS cnt FROM "SceneEntry" WHERE status = 'published' AND kind = 'travel' GROUP BY country ORDER BY 2 DESC
    `.catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
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
    return s ? `/travel?${s}` : '/travel';
  };

  const cards = [
    { href: '/tools/web-translator', title: '网页翻译', desc: '外文旅行攻略一键翻译' },
    { href: '/tools/image-translator', title: '图片翻译', desc: '路牌/菜单/票据拍照翻译' },
    { href: '/life', title: '海外生活', desc: '移居留学场景表达' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>旅行语言</h1>
        <p>出国场景常用语对照——点餐、问路、住宿、购物，开口就能用</p>
        <form className="search-box" action="/travel" method="get">
          <input type="search" name="q" placeholder="搜索场景：点餐 / 问路 / 住宿…" defaultValue={q} />
          <button type="submit" className="primary">搜索</button>
          {q && <a className="clear-link" href="/travel">清除</a>}
        </form>
      </section>

      <div className="chips">
        <Link className={!country ? 'chip chip-active' : 'chip'} href={href({ country: '' })}>全部</Link>
        {countryList.slice(0, 24).map((c) => (
          <Link key={c.country} className={country === c.country ? 'chip chip-active' : 'chip'} href={href({ country: c.country })}>
            {countryName(c.country)} <span className="chip-cnt">{c.cnt}</span>
          </Link>
        ))}
      </div>

      {!q && !country && (
        <>
          <h2 className="section-title">热门场景 TOP10</h2>
          <div className="entry-grid">
            {hot.map((s) => (
              <Link key={s.slug} className="entry-card" href={`/travel/${s.country}/${s.slug}`}>
                <div className="term">{s.title}</div>
                <div className="mn">{s.intro}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录旅行场景（{total}）</h2>
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

      {items.length === 0 && (page > totalPages ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          当前页超出范围（共 {totalPages} 页），<Link href={href({ page: String(totalPages) })} style={{ color: 'var(--accent2)' }}>查看最后一页</Link>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          没有找到匹配的旅行场景，换个关键词或国家试试？
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

      <h2 className="section-title" style={{ marginTop: 32 }}>翻译工具</h2>
      <div className="entry-grid">
        {cards.map((c) => (
          <Link key={c.href} className="entry-card" href={c.href}>
            <div className="term">{c.title}</div>
            <div className="mn">{c.desc}</div>
          </Link>
        ))}
      </div>
      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>旅行场景内容按批次建设中——先试试 AI 翻译工具。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
