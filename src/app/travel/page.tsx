import { prisma } from '@/lib/db';
import Link from 'next/link';
import { countryName, langName } from '@/lib/content/locales';

export const revalidate = 300;

export const metadata = {
  title: '旅行语言 · 出国常用外语表达 | 爱翻译',
  description: '旅行语言栏目：机场、酒店、餐厅、购物、问路场景的当地语言表达，出国前速查。',
};

export default async function TravelIndexPage() {
  const items = await prisma.sceneEntry.findMany({
    where: { status: 'published', kind: 'travel' },
    orderBy: { popularity: 'desc' },
    take: 48,
    select: { slug: true, country: true, title: true, lang: true },
  }).catch(() => []);
  const total = await prisma.sceneEntry.count({ where: { status: 'published', kind: 'travel' } }).catch(() => items.length);

  const colCards = [
    { href: '/life', title: '海外生活', desc: '租房、就医、办证场景表达' },
    { href: '/idioms', title: '成语谚语', desc: '中文成语的地道外文表达' },
    { href: '/untranslatable', title: '难翻译词', desc: '无法直译却精准表达心情的词' },
    { href: '/menu', title: '菜单词典', desc: '各国菜单菜名翻译' },
    { href: '/recipes', title: '全球美食', desc: '跨语言菜谱' },
    { href: '/meme', title: '网络用语', desc: '各国网络热梗翻译' },
  ];

  const cards = [
    { href: '/voice', title: '语音翻译', desc: '不会读？让 AI 帮你翻译并朗读' },
    { href: '/tools/image-translator', title: '图片翻译', desc: '路牌菜单看不懂？拍照即译' },
    { href: '/tools/web-translator', title: '网页翻译', desc: '海外订房订票网站一键整页翻译' },
  ];

  return (
    <div>
      <section className="hero">
        <h1>旅行语言</h1>
        <p>出国前速查——机场、酒店、餐厅、购物场景表达</p>
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
      <h2 className="section-title">相关栏目</h2>
      <div className="entry-grid">
        {colCards.map((c2) => (
          <Link key={c2.href} className="entry-card" href={c2.href}>
            <div className="term">{c2.title}</div>
            <div className="mn">{c2.desc}</div>
          </Link>
        ))}
      </div>
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
