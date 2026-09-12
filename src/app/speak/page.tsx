import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { SPEAK_SCENARIOS } from '@/lib/content/speak-scenarios';

/** /speak 场景列表页（可索引）：7 张场景卡 + 使用说明 */
export const metadata: Metadata = buildMetadata({
  path: '/speak',
  title: '场景英语怎么说：7 大场景表达指南 | 爱翻译',
  description:
    '旅行、商务、电商、职场、社交、恋爱、学习 7 大场景的「英语怎么说」表达指南：高频表达卡、场景对话、真实词条内链，配合爱翻译 AI 翻译随查随用。',
  keywords: ['场景英语', '英语怎么说', '地道表达', '口语指南', '爱翻译'],
  ogType: 'list',
});

export default function SpeakIndexPage() {
  return (
    <div>
      <section className="hero">
        <h1>场景表达指南</h1>
        <p>同一个意思，换个场景就该换个说法。7 大场景，高频表达 + 场景对话 + 真实词条内链。</p>
      </section>

      <div className="entry-grid">
        {SPEAK_SCENARIOS.map((s) => (
          <Link key={s.slug} className="entry-card" href={`/speak/${s.slug}`}>
            <div className="term">
              {s.name}英语怎么说
            </div>
            <div className="mn">{s.sections.length} 个子场景 · {s.top10.length} 句高频表达</div>
            <div className="mn">{s.intro.slice(0, 42)}…</div>
          </Link>
        ))}
      </div>

      <div className="result" style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>怎么用</div>
        <div style={{ marginTop: 6, lineHeight: 1.9 }}>
          ① 先在场景页找现成表达（点卡片即看译文）；② 找不到就复制进首页翻译框，AI 会按场景给出地道译文；
          ③ 同一句中文翻得准不准？去 <Link href="/arena" style={{ color: 'var(--accent2)' }}>翻译擂台</Link> 看三个 AI 的匿名对比。
        </div>
      </div>
    </div>
  );
}
