import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = buildMetadata({
  path: '/languages',
  title: "世界语言 · 日语 · 韩语 · 法语 | 爱翻译",
  description: "世界语言栏目：日语、韩语、英语、法语、德语、西班牙语、泰语等 14 种语言入口，旅行常用语、菜单词汇、地道表达与语言文化。",
  ogType: 'list',
});

export default function LanguagesIndexPage() {
  const cards = [
    { href: '/languages/japanese', title: "日语", desc: "日本語 · 日语（日本語）是日本的官方语言，使用汉字、平假名、片假名混合书写。日语与中文共享" },
    { href: '/languages/korean', title: "韩语", desc: "한국어 · 韩语（한국어）是韩国的官方语言，使用韩文字母书写，语序与中文不同，但约六成汉字词" },
    { href: '/languages/english', title: "英语", desc: "English · 英语是全球通用语，也是爱翻译内容最深的语言对——俚语热词、难译词、中英场景表达全" },
    { href: '/languages/french', title: "法语", desc: "Français · 法语（Français）是法国及 20 余国的官方语言，属罗曼语族。法国旅行点餐" },
    { href: '/languages/german', title: "德语", desc: "Deutsch · 德语（Deutsch）是德国、奥地利等国的官方语言，以复合长词和严谨语法著称。德" },
    { href: '/languages/spanish', title: '西班牙语（Español）', desc: '西班牙 & 拉美旅行常用语、菜单词汇、地道表达入口' },
    { href: '/languages/italian', title: "意大利语", desc: "Italiano · 意大利语（Italiano）是意大利官方语言，也是音乐与餐饮术语的国际源头。意大" },
    { href: '/languages/thai', title: "泰语", desc: "ภาษาไทย · 泰语（ภาษาไทย）是泰国官方语言，有独立的文字系统与五个声调。泰国旅行、夜市" },
    { href: '/languages/russian', title: "俄语", desc: "Русский · 俄语（Русский）是俄罗斯官方语言，使用西里尔字母书写，是联合国六大官方语言" },
    { href: '/languages/portuguese', title: "葡萄牙语", desc: "Português · 葡萄牙语（Português）是葡萄牙、巴西等九国官方语言，全球母语人口约 2." },
    { href: '/languages/polish', title: "波兰语", desc: "Polski · 波兰语（Polski）是波兰官方语言，属西斯拉夫语支。波兰旅行、海外生活常用语与" },
    { href: '/languages/hindi', title: "印地语", desc: "हिन्दी · 印地语（हिन्दी）是印度联邦官方语言之一，使用天城文书写。印度旅行常用语与印" },
    { href: "/languages/vietnamese", title: "越南语", desc: "Tiếng Việt · 越南旅行常用语与菜单词汇" },
    { href: "/languages/turkish", title: "土耳其语", desc: "Türkçe · 土耳其旅行常用语与菜单词汇" },
  ];
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
        <p>没找到想查的语言？直接问 AI 翻译工具。</p>
        <a href="/#translator" className="btn primary">开始翻译（选语言对）→</a>
      </div>
    </div>
  );
}
