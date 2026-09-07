import type { Metadata } from 'next';
import Link from 'next/link';
import { buildListMetadata } from '@/lib/seo';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 48;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; page?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  return buildListMetadata({
    basePath: '/understand/slang',
    params: sp,
    title: '网络用语与俚语大全 · Slang 是什么意思 | 爱翻译',
    description: '网络热梗与俚语含义大全：职场黑话、恋爱用语、游戏术语、缩写黑话，一句中文梗一句地道英文，含语境与例句。',
    keywords: ['网络用语大全', '俚语含义', 'slang 中文意思', '热梗翻译'],
  });
}

export default async function SlangPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const tag = (sp.tag ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: any = {
    status: 'published',
    ...(q ? { OR: [{ term: { contains: q } }, { meaning: { contains: q } }, { translation: { contains: q } }] } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
  };

  const [total, memes, tags] = await Promise.all([
    prisma.memeEntry.count({ where }).catch(() => 0),
    prisma.memeEntry.findMany({
      where,
      orderBy: [{ popularity: 'desc' }, { term: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { slug: true, term: true, meaning: true, translation: true, shortAnswer: true },
    }).catch(() => []),
    prisma.$queryRaw`SELECT unnest(tags) AS tag, COUNT(*)::int AS n FROM "MemeEntry" WHERE status = 'published' GROUP BY tag ORDER BY n DESC LIMIT 24`.catch(() => []),
  ] as const);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container">
      <section className="hero">
        <h1>网络用语与俚语</h1>
        <p>{total} 条热梗与俚语——含义、语境、地道英文翻译。</p>
      </section>

      <form className="filter-bar" action="/understand/slang" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="搜梗 / 俚语 / 缩写，如 yyds" />
        <button type="submit" className="btn primary">搜索</button>
      </form>

      {Array.isArray(tags) && (tags as { tag: string; n: number }[]).length > 0 && (
        <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0' }}>
          <Link className={'chip' + (tag ? '' : ' chip-on')} href="/understand/slang">全部</Link>
          {(tags as { tag: string; n: number }[]).map((t) => (
            <Link key={t.tag} className={'chip' + (tag === t.tag ? ' chip-on' : '')} href={`/understand/slang?tag=${encodeURIComponent(t.tag)}`}>#{t.tag}</Link>
          ))}
        </div>
      )}

      <div className="entry-grid">
        {memes.map((m) => (
          <Link key={m.slug} className="entry-card" href={`/meme/${m.slug}`}>
            <div className="term">{m.term}</div>
            <div className="tr">{(m.shortAnswer as string) || m.translation}</div>
          </Link>
        ))}
      </div>

      {memes.length === 0 && (
        <div className="cta-box">
          <p>没找到「{q}」——它可能太新了。问问 AI 怎么翻，或者过几天再来看看。</p>
          <a href="/" className="btn primary">问 AI</a>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pager" style={{ display: 'flex', gap: 8, margin: '20px 0', flexWrap: 'wrap' }}>
          {page > 1 && <Link className="btn" href={`/understand/slang?page=${page - 1}${tag ? '&tag=' + encodeURIComponent(tag) : ''}`}>上一页</Link>}
          <span className="pager-info">第 {page} / {totalPages} 页</span>
          {page < totalPages && <Link className="btn" href={`/understand/slang?page=${page + 1}${tag ? '&tag=' + encodeURIComponent(tag) : ''}`}>下一页</Link>}
        </div>
      )}
    </div>
  );
}
