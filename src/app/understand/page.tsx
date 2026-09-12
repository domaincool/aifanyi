import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  path: '/understand',
  title: '看懂语言 · 网络用语/成语/难翻译词/俚语是什么意思 | 爱翻译',
  description: '看懂语言的频道：网络用语、成语谚语、难翻译词、俚语与流行表达的含义、语境与地道翻译。一个词一个世界，爱翻译帮你真正听懂。',
  keywords: ['网络用语是什么意思', '成语英文', '难翻译词', '俚语含义', '看懂语言'],
  ogType: 'list',
});

export default async function UnderstandHub() {
  // 各栏目录数（DB 失败时仍渲染）
  let counts = { meme: 0, idiom: 0, untranslatable: 0, expression: 0 };
  try {
    const [m, i, u, e] = await Promise.all([
      prisma.memeEntry.count({ where: { status: 'published' } }),
      prisma.expressionEntry.count({ where: { status: 'published', type: 'idiom' } }),
      prisma.expressionEntry.count({ where: { status: 'published', type: 'untranslatable' } }),
      prisma.expressionEntry.count({ where: { status: 'published' } }),
    ]);
    counts = { meme: m, idiom: i, untranslatable: u, expression: e };
  } catch {}

  const lines = [
    { href: '/meme', ico: '🔥', name: '网络用语与俚语', desc: '热梗 · 缩写 · 黑话——中文互联网的每一句潜台词', count: counts.meme },
    { href: '/untranslatable', ico: '🧩', name: '难翻译词词典', desc: 'komorebi · wabi-sabi——那些英语里找不到对应词的世界', count: counts.untranslatable },
    { href: '/idioms', ico: '📜', name: '成语谚语翻译', desc: '画蛇添足 · 亡羊补牢——四字里的千年智慧怎么翻', count: counts.idiom },
    { href: '/understand/meaning', ico: '💬', name: '词义快答', desc: '一句话快答：这个词到底什么意思、怎么用', count: 0 },
  ];

  return (
    <div className="container">
      <section className="hero">
        <h1>看懂语言</h1>
        <p>不只是翻译——理解每个词背后的语境、文化与情绪。{counts.expression}+ 词条持续更新。</p>
      </section>
      <div className="entry-grid">
        {lines.map((l) => (
          <Link key={l.href} className="entry-card" href={l.href}>
            <div className="term">{l.ico} {l.name}{l.count > 0 && <span className="ud-count">{l.count}</span>}</div>
            <div className="tr">{l.desc}</div>
          </Link>
        ))}
      </div>
      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>想查的词这里没有？直接问 AI——把整句话丢进翻译框，看三种模型怎么理解。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
