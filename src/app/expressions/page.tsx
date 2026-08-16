// 6 个栏目聚合页生成（Mega Menu 落地页，消除 404 死链）
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '词汇与表达 · 成语 · 俚语 · 难翻译词 | 爱翻译',
  description: '词汇与表达栏目：网络用语翻译（Meme）、成语谚语翻译、俚语、难翻译词（Untranslatable）。一句中文，一句地道外语。',
};

export default async function ExpressionsIndexPage() {
  const [memeCount, idiomCount] = await Promise.all([
    prisma.memeEntry.count({ where: { status: 'published' } }),
    prisma.expressionEntry.count({ where: { status: 'published', type: 'idiom' } }),
  ]);

  const sections = [
    { href: '/meme', title: '网络用语翻译', desc: `${memeCount} 个网络热梗地道翻译`, icon: 'Meme' },
    { href: '/idioms', title: '成语谚语翻译', desc: `${idiomCount} 个成语谚语地道英文`, icon: '成语' },
    { href: '/untranslatable', title: '难翻译词', desc: '无法直译的外语单词（建设中）', icon: '词汇' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>词汇与表达</h1>
        <p>一句中文，一句地道外语——网络梗、成语谚语、难翻译词全收录</p>
      </section>
      <div className="entry-grid">
        {sections.map((s) => (
          <Link key={s.href} className="entry-card" href={s.href}>
            <div className="term">{s.title}</div>
            <div className="tr">{s.icon}</div>
            <div className="mn">{s.desc}</div>
          </Link>
        ))}
      </div>
      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>有词不会翻？用 AI 翻译工作台试试。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
