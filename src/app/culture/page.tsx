import Link from 'next/link';

export const metadata = {
  title: '语言与文化 · 语言冷知识 · 文化差异 | 爱翻译',
  description: '语言与文化栏目：语言冷知识、文化差异、词源趣闻，理解语言背后的世界。',
};

export default function CultureIndexPage() {
  const cards = [{"href":"/blindtest","title":"AI 翻译擂台","desc":"多模型匿名译文对比，玩着学翻译"},{"href":"/meme","title":"网络用语","desc":"了解一国文化，从热梗开始"},{"href":"/updates","title":"上线公告","desc":"爱翻译的新功能与内容更新"}];
  return (
    <div>
      <section className="hero">
        <h1>语言与文化</h1>
        <p>语言冷知识 · 文化差异 · 词源趣闻</p>
      </section>
      <div className="entry-grid">
        {cards.map((c) => (
          <Link key={c.href} className="entry-card" href={c.href}>
            <div className="term">{c.title}</div>
            <div className="mn">{c.desc}</div>
          </Link>
        ))}
      </div>
      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>栏目内容持续建设中——先试试 AI 翻译工具。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
