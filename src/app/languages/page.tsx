import Link from 'next/link';

export const metadata = {
  title: '世界语言 · 日语 · 韩语 · 法语 | 爱翻译',
  description: '世界语言栏目：日语、韩语、泰语、法语等语言入口聚合，语言冷知识与文化差异。',
};

export default function LanguagesIndexPage() {
  const cards = [{"href":"/languages/vietnamese","title":"越南语","desc":"Tiếng Việt · 越南旅行常用语与菜单词汇"},{"href":"/languages/turkish","title":"土耳其语","desc":"Türkçe · 土耳其旅行常用语与菜单词汇"},{"href":"/idioms","title":"成语谚语","desc":"中文成语的地道外文表达"},{"href":"/meme","title":"网络用语","desc":"各国网络热梗翻译"},{"href":"/tools","title":"全部工具","desc":"文本 · 语音 · 图片 · 文档翻译"}];
  return (
    <div>
      <section className="hero">
        <h1>世界语言</h1>
        <p>用语言探索世界——各国语言入口与语言文化</p>
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
