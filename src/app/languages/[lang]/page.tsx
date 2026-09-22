import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const LANG_SLUGS: Record<
  string,
  { country: string | null; lang: string; name: string; native: string; intro: string; section: string; links?: Array<{ href: string; title: string; desc: string }> }
> = {
  vietnamese: {
    country: 'vietnam',
    lang: 'vi',
    name: '越南语',
    native: 'Tiếng Việt',
    intro: '越南语（Tiếng Việt）是越南的官方语言，使用以拉丁字母为基础的国语字书写系统，声调丰富。',
    section: '越南',
  },
  spanish: {
    country: 'spain',
    lang: 'es',
    name: '西班牙语',
    native: 'Español',
    intro: '西班牙语（Español）是全球第二大母语，西班牙及拉丁美洲 20 余国官方语言，使用拉丁字母书写。',
    section: '西班牙',
  },
  turkish: {
    country: 'turkey',
    lang: 'tr',
    name: '土耳其语',
    native: 'Türkçe',
    intro: '土耳其语（Türkçe）是土耳其的官方语言，属于突厥语系，使用拉丁字母书写，语法以黏着构词著称。',
    section: '土耳其',
  },
  japanese: {
    country: "japan",
    lang: "ja",
    name: "日语",
    native: "日本語",
    intro: "日语（日本語）是日本的官方语言，使用汉字、平假名、片假名混合书写。日语与中文共享汉字文化圈，大量词形同义异——旅行点餐、购物扫码、交通出行的高频词差异都在这一页理清。",
    section: "日本",
  },
  korean: {
    country: "korea",
    lang: "ko",
    name: "韩语",
    native: "한국어",
    intro: "韩语（한국어）是韩国的官方语言，使用韩文字母书写，语序与中文不同，但约六成汉字词让中国学习者倍感亲切。韩国旅行点餐、咖啡店点单、地铁出行常用语与菜单词汇见本页。",
    section: "韩国",
  },
  english: {
    country: null,
    lang: "en",
    name: "英语",
    native: "English",
    intro: "英语是全球通用语，也是爱翻译内容最深的语言对——俚语热词、难译词、中英场景表达全覆盖。英语页聚合站内全部英语词条入口，从这里进快答、热梗与场景表达。",
    section: "英语",
    links: [
          {
                "href": "/understand/meaning",
                "title": "英语快答 · 俚语热词",
                "desc": "cringe/ghosting/rizz 等热词一句话快答 + 完整词条"
          },
          {
                "href": "/meme",
                "title": "网络热梗词典",
                "desc": "英文网络梗与中文梗的双向词典"
          },
          {
                "href": "/expressions",
                "title": "地道表达",
                "desc": "英语idiom与场景表达，配中文对照"
          },
          {
                "href": "/untranslatable",
                "title": "难译词博物馆",
                "desc": "中英都难翻译的概念词合集"
          }
    ],
  },
  french: {
    country: "france",
    lang: "fr",
    name: "法语",
    native: "Français",
    intro: "法语（Français）是法国及 20 余国的官方语言，属罗曼语族。法国旅行点餐、面包房点单、餐厅礼仪相关词汇与地道表达入口。",
    section: "法国",
  },
  german: {
    country: "germany",
    lang: "de",
    name: "德语",
    native: "Deutsch",
    intro: "德语（Deutsch）是德国、奥地利等国的官方语言，以复合长词和严谨语法著称。德国旅行常用语、海外生活词汇与菜单词汇入口。",
    section: "德国",
  },
  italian: {
    country: "italy",
    lang: "it",
    name: "意大利语",
    native: "Italiano",
    intro: "意大利语（Italiano）是意大利官方语言，也是音乐与餐饮术语的国际源头。意大利餐厅点菜、旅行问路常用词汇见本页。",
    section: "意大利",
  },
  thai: {
    country: "thailand",
    lang: "th",
    name: "泰语",
    native: "ภาษาไทย",
    intro: "泰语（ภาษาไทย）是泰国官方语言，有独立的文字系统与五个声调。泰国旅行、夜市点餐、海岛出行常用语入口。",
    section: "泰国",
  },
  russian: {
    country: "russia",
    lang: "ru",
    name: "俄语",
    native: "Русский",
    intro: "俄语（Русский）是俄罗斯官方语言，使用西里尔字母书写，是联合国六大官方语言之一。常用表达持续补充中，可先用 AI 翻译工具查任意俄语词句。",
    section: "俄罗斯",
  },
  portuguese: {
    country: "portugal",
    lang: "pt",
    name: "葡萄牙语",
    native: "Português",
    intro: "葡萄牙语（Português）是葡萄牙、巴西等九国官方语言，全球母语人口约 2.6 亿。葡萄牙旅行与生活词汇入口，巴西葡语差异会专门标注。",
    section: "葡萄牙",
  },
  polish: {
    country: "poland",
    lang: "pl",
    name: "波兰语",
    native: "Polski",
    intro: "波兰语（Polski）是波兰官方语言，属西斯拉夫语支。波兰旅行、海外生活常用语与菜单词汇入口。",
    section: "波兰",
  },
  hindi: {
    country: "india",
    lang: "hi",
    name: "印地语",
    native: "हिन्दी",
    intro: "印地语（हिन्दी）是印度联邦官方语言之一，使用天城文书写。印度旅行常用语与印度菜菜单词汇（玛莎拉、坦都里都在菜单库）入口。",
    section: "印度",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const cfg = LANG_SLUGS[lang];
  if (!cfg) return { title: '世界语言 | 爱翻译' };
  return {
    title: `${cfg.name}（${cfg.native}）学习与翻译入口 · ${cfg.section}旅行 | 爱翻译`,
    description: `${cfg.name}学习与翻译入口：${cfg.section}旅行常用语、菜单词汇、地道表达一页集合，支持 AI 翻译。爱翻译 · AI翻译。`,
  };
}

export default async function LanguageDetailPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const cfg = LANG_SLUGS[lang];

  if (!cfg) {
    return (
      <div>
        <section className="hero">
          <h1>世界语言</h1>
          <p>用语言探索世界——各国语言入口与语言文化</p>
        </section>
        <div className="cta-box">
          <p>该语言内容整理中，先试试 AI 翻译工具。</p>
          <a href="/#translator" className="btn primary">用翻译器翻任意语言 →</a>
        </div>
      </div>
    );
  }

  const [travel, life, menus, exprs] = await Promise.all([
    prisma.sceneEntry
      .findMany({
        where: { status: 'published', kind: 'travel', ...(cfg.country ? { country: cfg.country } : { slug: '__none__' }) },
        orderBy: [{ popularity: 'desc' }, { title: 'asc' }],
        take: 12,
        select: { slug: true, title: true, intro: true },
      })
      .catch(() => []),
    prisma.sceneEntry
      .findMany({
        where: { status: 'published', kind: 'life', ...(cfg.country ? { country: cfg.country } : { slug: '__none__' }) },
        orderBy: [{ popularity: 'desc' }, { title: 'asc' }],
        take: 12,
        select: { slug: true, title: true, intro: true },
      })
      .catch(() => []),
    prisma.menuEntry
      .findMany({
        where: { status: 'published', ...(cfg.country ? { country: cfg.country } : { slug: '__none__' }) },
        orderBy: { popularity: 'desc' },
        take: 12,
        select: { slug: true, dish: true, romanized: true, zh: true },
      })
      .catch(() => []),
    prisma.expressionEntry
      .findMany({
        where: { status: 'published', lang: cfg.lang },
        orderBy: [{ popularity: 'desc' }, { term: 'asc' }],
        take: 30,
        select: { slug: true, term: true, translation: true, type: true },
      })
      .catch(() => []),
  ]);

  const empty = travel.length + life.length + menus.length + exprs.length === 0;

  return (
    <div>
      <section className="hero">
        <h1>
          {cfg.name} <span style={{ fontSize: '0.55em', fontWeight: 400, color: 'var(--muted)' }}>{cfg.native}</span>
        </h1>
        <p>{cfg.intro}</p>
      </section>

      {empty ? (
        <div className="cta-box">
          <p>{cfg.section}内容持续补充中，先试试 AI 翻译工具。</p>
          <a href="/#translator" className="btn primary">用翻译器翻{cfg.name} →</a>
        </div>
      ) : (
        <>
          {cfg.links && cfg.links.length > 0 && (
            <>
              <h2 className="section-title">站内资源</h2>
              <div className="entry-grid">
                {cfg.links.map((l) => (
                  <Link key={l.href} className="entry-card" href={l.href}>
                    <div className="term">{l.title}</div>
                    <div className="mn">{l.desc}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {travel.length > 0 && (
            <>
              <h2 className="section-title">旅行常用语（{travel.length}）</h2>
              <div className="entry-grid">
                {travel.map((s) => (
                  <Link key={s.slug} className="entry-card" href={`/travel/${cfg.country}/${s.slug}`}>
                    <div className="term">{s.title}</div>
                    <div className="mn">{s.intro}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {life.length > 0 && (
            <>
              <h2 className="section-title">海外生活（{life.length}）</h2>
              <div className="entry-grid">
                {life.map((s) => (
                  <Link key={s.slug} className="entry-card" href={`/life/${cfg.country}/${s.slug}`}>
                    <div className="term">{s.title}</div>
                    <div className="mn">{s.intro}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {menus.length > 0 && (
            <>
              <h2 className="section-title">菜单词汇（{menus.length}）</h2>
              <div className="entry-grid">
                {menus.map((m) => (
                  <Link key={m.slug} className="entry-card" href={`/menu/${cfg.country}/${m.slug}`}>
                    <div className="term">
                      {m.dish} {m.romanized ? <span style={{ fontWeight: 400, fontSize: '0.8em', color: 'var(--muted)' }}>{m.romanized}</span> : null}
                    </div>
                    <div className="mn">{m.zh}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {exprs.length > 0 && (
            <>
              <h2 className="section-title">地道表达（{exprs.length}）</h2>
              <div className="entry-grid">
                {exprs.map((e) => (
                  <Link
                    key={e.slug}
                    className="entry-card"
                    href={e.type === 'untranslatable' ? `/untranslatable/${e.slug}` : `/idioms/${e.slug}`}
                  >
                    <div className="term">{e.term}</div>
                    <div className="mn">{e.translation}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="cta-box" style={{ marginTop: 28 }}>
            <p>
              {cfg.name}翻译——文本 / 语音 / 图片 / 文档都能翻。
            </p>
            <a href="/#translator" className="btn primary">用翻译器翻{cfg.name} →</a>
          </div>
        </>
      )}
    </div>
  );
}
