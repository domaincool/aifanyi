import Link from 'next/link';

export const metadata = {
  title: '全球美食 · 菜谱翻译 · 菜单词典 | 爱翻译',
  description: '全球美食栏目：跨语言菜谱、菜单词典、食材与烹饪词汇。看懂菜单、做出好菜。',
};

export default function RecipesIndexPage() {
  const cards = [{"href":"/menu","title":"菜单词典","desc":"各国菜单菜名翻译（建设中）"},{"href":"/tools/image-translator","title":"图片翻译","desc":"拍下看不懂的菜单，直接翻译"},{"href":"/tools/pdf-translator","title":"PDF 翻译","desc":"有 PDF 菜谱看不懂？上传翻译"}];
  return (
    <div>
      <section className="hero">
        <h1>全球美食</h1>
        <p>看懂菜单，做出好菜——跨语言菜谱与菜单词典</p>
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
