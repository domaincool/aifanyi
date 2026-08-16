import Link from 'next/link';

export const metadata = {
  title: '海外生活 · 租房 · 工作 · 银行表达 | 爱翻译',
  description: '海外生活栏目：租房、工作、银行、快递、医疗场景的外语表达，异国生活不慌。',
};

export default function LifeIndexPage() {
  const cards = [{"href":"/tools/doc-translator","title":"文档翻译","desc":"合同、证件、邮件整篇翻译"},{"href":"/tools/web-translator","title":"网页翻译","desc":"海外网站看不懂？一键整页翻译"},{"href":"/voice","title":"语音翻译","desc":"开口就说，实时翻译"}];
  return (
    <div>
      <section className="hero">
        <h1>海外生活</h1>
        <p>异国生活不慌——租房、工作、银行场景表达</p>
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
