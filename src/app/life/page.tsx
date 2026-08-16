import { prisma } from '@/lib/db';
import Link from 'next/link';
import { countryName, langName } from '@/lib/content/locales';

export const revalidate = 300;

export const metadata = {
  title: '海外生活 · 移居留学常用外语表达 | 爱翻译',
  description: '海外生活栏目：租房、就医、银行、办证等生活场景的当地语言表达。',
};

export default async function LifeIndexPage() {
  const items = await prisma.sceneEntry.findMany({
    where: { status: 'published', kind: 'life' },
    orderBy: { popularity: 'desc' },
    take: 48,
    select: { slug: true, country: true, title: true, lang: true },
  }).catch(() => []);
  const total = await prisma.sceneEntry.count({ where: { status: 'published', kind: 'life' } }).catch(() => items.length);

  const cards = [
    { href: '/voice', title: '语音翻译', desc: '不会读？让 AI 帮你翻译并朗读' },
    { href: '/tools/web-translator', title: '网页翻译', desc: '租房办证网站一键整页翻译' },
    { href: '/tools/pdf-translator', title: 'PDF 翻译', desc: '合同文件 PDF 上传翻译' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>海外生活</h1>
        <p>租房、就医、银行、办证——生活场景表达速查</p>
      </section>
      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录场景（{total}）</h2>
          <div className="entry-grid">
            {items.map((s) => (
              <Link key={s.slug} className="entry-card" href={`/travel/${s.country}/${s.slug}`}>
                <div className="term">{s.title}</div>
                <div className="tr">{countryName(s.country)} · {langName(s.lang) || ''}</div>
              </Link>
            ))}
          </div>
        </>
      )}
      <h2 className="section-title">翻译工具</h2>
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
