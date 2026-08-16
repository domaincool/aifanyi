import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '难翻译词 · 无法直译的外语单词 | 爱翻译',
  description: '难翻译词栏目：Komorebi、Schadenfreude、Dépaysement……无法直译却精准表达某种情感的外语单词。',
};

export default async function UntranslatableIndexPage() {
  const items = await prisma.expressionEntry.findMany({
    where: { status: 'published', type: 'untranslatable' },
    orderBy: { popularity: 'desc' },
    take: 48,
    select: { slug: true, term: true, translation: true, meaning: true },
  }).catch(() => []);

  const cards = [
    { href: '/idioms', title: '成语谚语', desc: '中文成语的地道外文表达' },
    { href: '/meme', title: '网络用语', desc: '各国网络热梗翻译' },
    { href: '/', title: 'AI 翻译', desc: '工作台翻译，多模型对比' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>难翻译词</h1>
        <p>无法直译，却精准表达一种心情——外语单词精选</p>
      </section>
      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录难翻译词（{items.length}）</h2>
          <div className="entry-grid">
            {items.map((e) => (
              <Link key={e.slug} className="entry-card" href={`/untranslatable/${e.slug}`}>
                <div className="term">{e.term}</div>
                <div className="tr">{e.translation}</div>
                <div className="mn">{e.meaning}</div>
              </Link>
            ))}
          </div>
        </>
      )}
      <h2 className="section-title">相关栏目</h2>
      <div className="entry-grid">
        {cards.map((c) => (
          <Link key={c.href} className="entry-card" href={c.href}>
            <div className="term">{c.title}</div>
            <div className="mn">{c.desc}</div>
          </Link>
        ))}
      </div>
      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>难翻译词条目按批次建设中——先试试 AI 翻译工作台。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
