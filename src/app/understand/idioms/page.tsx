import type { Metadata } from 'next';
import Link from 'next/link';
import { buildListMetadata, SITE_URL } from '@/lib/seo';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 48;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  return buildListMetadata({
    basePath: '/understand/idioms',
    params: sp,
    title: '成语谚语英文翻译大全 | 爱翻译',
    description: '成语谚语的地道英文表达：画蛇添足、亡羊补牢、破釜沉舟……含拼音、直译、例句与出处，一句成语一句地道英文。',
    keywords: ['成语英文', '成语翻译', '谚语英文怎么说'],
  });
}

export default async function IdiomsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: any = {
    status: 'published',
    type: 'idiom',
    ...(q ? { OR: [{ term: { contains: q } }, { meaning: { contains: q } }, { translation: { contains: q } }] } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.expressionEntry.count({ where }).catch(() => 0),
    prisma.expressionEntry.findMany({
      where,
      orderBy: [{ popularity: 'desc' }, { term: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { slug: true, term: true, meaning: true, translation: true, shortAnswer: true },
    }).catch(() => []),
  ] as const);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container">
      <section className="hero">
        <h1>成语谚语翻译</h1>
        <p>{total} 条成语谚语——四字千年智慧的地道英文表达。</p>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: entries.map((m, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}/idioms/${m.slug}`,
              name: m.term,
            })),
          }),
        }}
      />

      <form className="filter-bar" action="/understand/idioms" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="搜成语，如 画蛇添足" />
        <button type="submit" className="btn primary">搜索</button>
      </form>

      <div className="entry-grid">
        {entries.map((e) => (
          <Link key={e.slug} className="entry-card" href={`/idioms/${e.slug}`}>
            <div className="term">{e.term}</div>
            <div className="tr">{(e.shortAnswer as string) || e.translation}</div>
          </Link>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="cta-box">
          <p>没找到「{q}」。问 AI 这个成语怎么翻——</p>
          <a href="/" className="btn primary">问 AI</a>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pager" style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
          {page > 1 && <Link className="btn" href={`/understand/idioms?page=${page - 1}`}>上一页</Link>}
          <span>第 {page} / {totalPages} 页</span>
          {page < totalPages && <Link className="btn" href={`/understand/idioms?page=${page + 1}`}>下一页</Link>}
        </div>
      )}
    </div>
  );
}
