import { prisma } from '@/lib/db';
import Link from 'next/link';
import { countryName } from '@/lib/content/locales';

export const revalidate = 300;

export const metadata = {
  title: '菜单词典 · 各国菜单菜名翻译 | 爱翻译',
  description: '菜单词典栏目：日韩泰法意各国菜单菜名翻译——看不懂的菜名，拍下来就能翻。',
};

const PAGE_SIZE = 48;

export default async function MenuIndexPage({
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
    ...(country ? { country } : {}),
    ...(q
      ? {
          OR: [
            { zh: { contains: q } },
            { en: { contains: q } },
            { dish: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, items, hot, countries] = await Promise.all([
    prisma.menuEntry.count({ where }).catch(() => 0),
    prisma.menuEntry
      .findMany({
        where,
        orderBy: [{ popularity: 'desc' }, { zh: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { slug: true, country: true, zh: true, en: true, romanized: true, popularity: true },
      })
      .catch(() => []),
    !q && !country
      ? prisma.menuEntry
          .findMany({
            where: { status: 'published' },
            orderBy: { popularity: 'desc' },
            take: 10,
            select: { slug: true, country: true, zh: true, en: true, romanized: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.$queryRaw<{ country: string; cnt: bigint }[]>`
      SELECT country, count(*) AS cnt FROM "MenuEntry" WHERE status = 'published' GROUP BY country ORDER BY 2 DESC
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
    return s ? `/menu?${s}` : '/menu';
  };

  const cards = [
    { href: '/tools/image-translator', title: '图片翻译', desc: '拍下看不懂的菜单，直接翻译' },
    { href: '/tools/pdf-translator', title: 'PDF 翻译', desc: '菜单 PDF 上传翻译' },
    { href: '/recipes', title: '全球美食', desc: '跨语言菜谱栏目' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>菜单词典</h1>
        <p>看懂菜单，点对菜——各国菜单菜名翻译持续收录中</p>
        <form className="search-box" action="/menu" method="get">
          <input type="search" name="q" placeholder="搜索菜名：烤鸡肉串 / ramen / 生鱼片…" defaultValue={q} />
          <button type="submit" className="primary">搜索</button>
          {q && <a className="clear-link" href="/menu">清除</a>}
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

      {!q && !country && (
        <>
          <h2 className="section-title">热门菜名 TOP10</h2>
          <div className="entry-grid">
            {hot.map((m) => (
              <Link key={m.slug} className="entry-card" href={`/menu/${m.country}/${m.slug}`}>
                <div className="term">{m.zh}{m.romanized ? `（${m.romanized}）` : ''}</div>
                <div className="tr">{m.en || countryName(m.country)}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录菜单词条（{total}）</h2>
          <div className="entry-grid">
            {items.map((m) => (
              <Link key={m.slug} className="entry-card" href={`/menu/${m.country}/${m.slug}`}>
                <div className="term">{m.zh}{m.romanized ? `（${m.romanized}）` : ''}</div>
                <div className="tr">{m.en || countryName(m.country)}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          没有找到匹配的菜单词条，换个关键词或国家试试？
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
        <p>菜单词条内容按批次建设中——先试试 AI 翻译工具。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
