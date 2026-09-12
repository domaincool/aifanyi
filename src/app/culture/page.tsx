import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { CULTURE_ARTICLES } from '@/lib/content/culture-articles';

/**
 * /culture 列表页（可索引）：首批 3 篇文化文章卡片
 * 蓝图 3.5.6：先建列表页索引再上详情，避免空详情页入 sitemap
 */
export const metadata: Metadata = buildMetadata({
  path: '/culture',
  title: '语言与文化：语言冷知识 · 文化差异 · 词源趣闻 | 爱翻译',
  description:
    '语言与文化专栏：中文为什么有这么多网络缩写、东西方称呼文化差异、中式委婉语图鉴……看懂语言背后的世界，翻译不止于词句。',
  keywords: ['语言文化', '文化差异', '网络缩写', '委婉语', '称呼文化', '爱翻译'],
  ogType: 'list',
});

export default function CultureIndexPage() {
  return (
    <div>
      <section className="hero">
        <h1>语言与文化</h1>
        <p>语言冷知识 · 文化差异 · 词源趣闻——看懂语言背后的世界。</p>
      </section>

      <div className="entry-grid">
        {CULTURE_ARTICLES.map((a) => (
          <Link key={a.slug} className="entry-card" href={`/culture/${a.slug}`}>
            <div className="term">{a.h1.split('：')[0]}</div>
            <div className="mn">{a.oneLiner.slice(0, 48)}…</div>
            <div className="mn" style={{ marginTop: 8, opacity: 0.75 }}>{a.points.length} 个文化子点 · 2 段文化冲突对话</div>
          </Link>
        ))}
      </div>

      <div className="entry-grid">
        <Link className="entry-card" href="/meme">
          <div className="term">网络用语</div>
          <div className="mn">了解一国文化，从热梗开始</div>
        </Link>
        <Link className="entry-card" href="/untranslatable">
          <div className="term">不可直译的词</div>
          <div className="mn">每个词都是一扇文化之窗</div>
        </Link>
        <Link className="entry-card" href="/arena">
          <div className="term">AI 翻译擂台</div>
          <div className="mn">多模型匿名译文对比，玩着学翻译</div>
        </Link>
      </div>
    </div>
  );
}
