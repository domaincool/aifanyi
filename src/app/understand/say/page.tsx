import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  path: '/understand/say',
  title: '怎么说？高频词中英互译大全 | 爱翻译',
  description: '高频词怎么说：中→英「X 用英语怎么说」与英→中「X 中文什么意思」，按场景分类，含双语例句与相关表达。',
  ogType: 'list',
});

export default async function SayIndexPage() {
  const entries = await prisma.phraseEntry.findMany({
    where: { status: 'published' },
    orderBy: { popularity: 'desc' },
    take: 200,
    select: { slug: true, term: true, pair: true, translation: true, tags: true },
  }).catch(() => []);

  return (
    <div>
      <section className="hero">
        <h1>高频词，怎么说？</h1>
        <p>中→英、英→中双向：每个词一页，快答 + 例句 + 相关表达。</p>
      </section>
      <div className="entry-grid">
        {entries.map((e) => (
          <Link key={e.slug} className="entry-card" href={`/understand/say/${e.pair}/${e.slug}`}>
            <div className="term">{e.term}</div>
            <div className="tr">{e.translation}</div>
            <div className="mn">{e.pair === 'zh-en' ? '中 → 英' : '英 → 中'}</div>
          </Link>
        ))}
      </div>
      {entries.length === 0 && (
        <p className="empty-state">词条上线中，敬请稍候。</p>
      )}
    </div>
  );
}
