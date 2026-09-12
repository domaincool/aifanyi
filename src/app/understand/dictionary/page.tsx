import type { Metadata } from 'next';
import Link from 'next/link';
import { buildListMetadata, SITE_URL } from '@/lib/seo';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 48;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  return buildListMetadata({
    basePath: '/understand/dictionary',
    params: sp,
    title: '难翻译词词典 · Untranslatable Words | 爱翻译',
    description: '那些无法直译的词：komorebi、wabi-sabi、hygge——每个语言里都藏着别语言找不到的词。含义、文化背景与最接近的表达。',
    keywords: ['难翻译词', 'untranslatable', '词义解释', '文化差异'],
  });
}

export default async function DictionaryPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: any = {
    status: 'published',
    type: 'untranslatable',
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
        <h1>难翻译词词典</h1>
        <p>{total} 个无法直译的词——理解它们，就理解了一种文化。</p>
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
              url: `${SITE_URL}/untranslatable/${m.slug}`,
              name: m.term,
            })),
          }),
        }}
      />

      <form className="filter-bar" action="/understand/dictionary" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="搜词，如 komorebi" />
        <button type="submit" className="btn primary">搜索</button>
      </form>

      <div className="entry-grid">
        {entries.map((e) => (
          <Link key={e.slug} className="entry-card" href={`/untranslatable/${e.slug}`}>
            <div className="term">{e.term}</div>
            <div className="tr">{(e.shortAnswer as string) || e.translation}</div>
          </Link>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="cta-box">
          <p>没找到「{q}」。直接问 AI 这个词什么意思——</p>
          <a href="/" className="btn primary">问 AI</a>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pager" style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
          {page > 1 && <Link className="btn" href={`/understand/dictionary?page=${page - 1}`}>上一页</Link>}
          <span>第 {page} / {totalPages} 页</span>
          {page < totalPages && <Link className="btn" href={`/understand/dictionary?page=${page + 1}`}>下一页</Link>}
        </div>
      )}
    </div>
  );
}
