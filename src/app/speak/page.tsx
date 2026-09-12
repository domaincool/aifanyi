import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { SPEAK_SCENARIOS } from '@/lib/content/speak-scenarios';
import SpeakTool from '@/components/SpeakTool';

/**
 * /speak：7 张场景卡（人工核准内容）+「怎么说？」工具。
 * 无 q：可索引栏目页；带 ?q=：搜索结果态 → noindex（对齐 P2 硬规则）。
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}): Promise<Metadata> {
  let q = "";
  try {
    const sp = searchParams ? await searchParams : {};
    if (typeof sp?.q === 'string') q = sp.q.trim();
  } catch {}
  if (!q) {
    return buildMetadata({
      path: '/speak',
      title: '怎么说？场景英语怎么说：7 大场景表达指南 | 爱翻译',
      description:
        '旅行、商务、电商、职场、社交、恋爱、学习 7 大场景的「英语怎么说」表达指南：高频表达卡、场景对话、真实词条内链，配合爱翻译 AI 翻译随查随用。',
      keywords: ['场景英语', '英语怎么说', '怎么说', '地道表达', '口语指南', '爱翻译'],
      ogType: 'list',
    });
  }
  return buildMetadata({
    path: '/speak',
    title: `${q.slice(0, 30)} 怎么说？| 爱翻译`,
    description: '用中文说出你想表达的意思，看这句话在英语 / 日语 / 韩语 / 西班牙语里当地人怎么说。',
    ogType: 'list',
    noindex: true,
  });
}

export default async function SpeakIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  let initialQuery = '';
  try {
    const sp = searchParams ? await searchParams : {};
    if (typeof sp?.q === 'string') initialQuery = sp.q.slice(0, 200);
  } catch {}

  return (
    <div>
      <section className="hero">
        <h1>场景表达指南</h1>
        <p>同一个意思，换个场景就该换个说法。7 大场景，高频表达 + 场景对话 + 真实词条内链。</p>
      </section>

      <SpeakTool initialQuery={initialQuery} />

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
