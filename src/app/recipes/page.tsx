import { prisma } from '@/lib/db';
import Link from 'next/link';
import { countryName } from '@/lib/content/locales';
import type { Metadata } from 'next';
import { spStr, spPage } from '@/lib/content/sp-param';

export const dynamic = 'force-dynamic';

const metadataBase = {
  title: '全球美食菜谱 · 跨语言家常菜怎么做 | 爱翻译',
  description: '全球美食菜谱栏目：各国经典家常菜做法与翻译，食材、步骤、词汇一应俱全——宫保鸡丁、寿喜烧、越南河粉……',
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilter = !!(spStr(sp.q) || spStr(sp.category) || spPage(sp.page) > 1);
  return { ...metadataBase, robots: hasFilter ? { index: false, follow: true } : undefined };
}

const PAGE_SIZE = 48;

export default async function RecipesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = spStr(sp.q).slice(0, 64);
  const category = spStr(sp.category);
  const page = spPage(sp.page);

  const where: any = {
    status: 'published',
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { zhName: { contains: q } },
            { dish: { contains: q, mode: 'insensitive' } },
            { enName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items, hot, categories] = await Promise.all([
    prisma.recipeEntry.count({ where }).catch(() => 0),
    prisma.recipeEntry
      .findMany({
        where,
        orderBy: [{ popularity: 'desc' }, { zhName: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { slug: true, dish: true, zhName: true, enName: true, country: true, category: true },
      })
      .catch(() => []),
    !q && !category
      ? prisma.recipeEntry
          .findMany({
            where: { status: 'published' },
            orderBy: { popularity: 'desc' },
            take: 10,
            select: { slug: true, dish: true, zhName: true, enName: true, country: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.$queryRaw<{ category: string; cnt: bigint }[]>`
      SELECT category, count(*) AS cnt FROM "RecipeEntry" WHERE status = 'published' AND category IS NOT NULL GROUP BY category ORDER BY 2 DESC
    `.catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const categoryList = categories.map((c) => ({ category: c.category, cnt: Number(c.cnt) }));
  const catLabel: Record<string, string> = {
    main: '主菜', soup: '汤羹', snack: '小吃', dessert: '甜品', drink: '饮品', noodle: '面食', rice: '米饭', other: '其他',
  };

  const href = (extra: { q?: string; category?: string; page?: string }) => {
    const usp = new URLSearchParams();
    const qq = extra.q !== undefined ? extra.q : q;
    const cc = extra.category !== undefined ? extra.category : category;
    const pp = extra.page !== undefined ? extra.page : '';
    if (qq) usp.set('q', qq);
    if (cc) usp.set('category', cc);
    if (pp) usp.set('page', pp);
    const s = usp.toString();
    return s ? `/recipes?${s}` : '/recipes';
  };

  const cards = [
    { href: '/tools/web-translator', title: '网页翻译', desc: '外文菜谱网页一键翻译' },
    { href: '/tools/doc-translator', title: 'Word/PPT 翻译', desc: '菜谱文档翻译' },
    { href: '/menu', title: '菜单词典', desc: '各国菜单菜名翻译' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>全球美食菜谱</h1>
        <p>跨语言家常菜做法与翻译——看懂食谱，做出地道味</p>
        <form className="search-box" action="/recipes" method="get">
          <input type="search" name="q" placeholder="搜索菜谱：宫保鸡丁 / Kung Pao / 寿喜烧…" defaultValue={q} />
          <button type="submit" className="primary">搜索</button>
          {q && <a className="clear-link" href="/recipes">清除</a>}
        </form>
      </section>

      <div className="chips">
        <Link className={!category ? 'chip chip-active' : 'chip'} href={href({ category: '' })}>全部</Link>
        {categoryList.slice(0, 24).map((c) => (
          <Link key={c.category} className={category === c.category ? 'chip chip-active' : 'chip'} href={href({ category: c.category })}>
            {catLabel[c.category] || c.category} <span className="chip-cnt">{c.cnt}</span>
          </Link>
        ))}
      </div>

      {!q && !category && (
        <>
          <h2 className="section-title">热门菜谱 TOP10</h2>
          <div className="entry-grid">
            {hot.map((r) => (
              <Link key={r.slug} className="entry-card" href={`/recipes/${r.slug}`}>
                <div className="term">{r.zhName}</div>
                <div className="tr">{r.enName || r.dish}</div>
                <div className="mn">{r.country ? countryName(r.country) : ''}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录菜谱（{total}）</h2>
          <div className="entry-grid">
            {items.map((r) => (
              <Link key={r.slug} className="entry-card" href={`/recipes/${r.slug}`}>
                <div className="term">{r.zhName}</div>
                <div className="tr">{r.enName || r.dish}</div>
                <div className="mn">{r.country ? countryName(r.country) : ''}</div>
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
          没有找到匹配的菜谱，换个关键词或分类试试？
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
        <p>菜谱内容按批次建设中——先试试 AI 翻译工具。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
