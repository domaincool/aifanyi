import { prisma } from '@/lib/db';
import Link from 'next/link';
import { countryName } from '@/lib/content/locales';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '菜单词典 · 各国菜单菜名翻译 | 爱翻译',
  description: '菜单词典栏目：日韩泰法意各国菜单菜名翻译——看不懂的菜名，拍下来就能翻。',
};

export default async function MenuIndexPage() {
  const items = await prisma.menuEntry.findMany({
    where: { status: 'published' },
    orderBy: { popularity: 'desc' },
    take: 48,
    select: { slug: true, country: true, zh: true, en: true, romanized: true, popularity: true },
  }).catch(() => []);

  const cards = [
    { href: '/tools/image-translator', title: '图片翻译', desc: '拍下看不懂的菜单，直接翻译' },
    { href: '/tools/pdf-translator', title: 'PDF 翻译', desc: '菜单 PDF 上传翻译' },
    { href: '/recipes', title: '全球美食', desc: '跨语言菜谱栏目' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>菜单词典</h1>
        <p>看懂菜单，点对菜——各国菜单菜名翻译持续收录中</p>
      </section>
      {items.length > 0 && (
        <>
          <h2 className="section-title">已收录菜单词条（{items.length}）</h2>
          <div className="entry-grid">
            {items.map((m) => (
              <Link key={m.slug} className="entry-card" href={`/menu/${m.country}/${m.slug}`}>
                <div className="term">{m.zh}{m.romanized ? `（${m.romanized}）` : ''}</div>
                <div className="tr">{m.en || countryName(m.country)}</div>
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
        <p>菜单词条内容按批次建设中——先试试 AI 翻译工具。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </div>
  );
}
