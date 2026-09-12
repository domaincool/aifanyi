import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { SPEAK_SCENARIOS, getSpeakScenario, type SpeakEntry } from '@/lib/content/speak-scenarios';

/**
 * 模板 E：Speak 场景页 /speak/[scenario] ×7（蓝图 3.5.5）
 * SSG + generateStaticParams 七场景白名单 + dynamicParams=false（与 /translate/[pair] 同模式）
 * Schema：Article（P3 裁决：场景表达指南非步骤教学，不用 HowTo）
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return SPEAK_SCENARIOS.map((s) => ({ scenario: s.slug }));
}

type Props = { params: Promise<{ scenario: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scenario: slug } = await params;
  const s = getSpeakScenario(slug);
  if (!s) return {};
  return buildMetadata({
    path: `/speak/${s.slug}`,
    title: s.title,
    description: s.description,
    keywords: s.keywords,
    ogType: 'content',
    ogTitle: s.h1,
  });
}

function EntryCard({ e }: { e: SpeakEntry }) {
  // 短语型表达卡（native/zh/note）：静态句卡
  if (e.native) {
    return (
      <div className="entry-card">
        <div className="term">{e.term}</div>
        <div className="tr" style={{ color: 'var(--accent2)', fontWeight: 600 }}>{e.native}</div>
        <div className="mn">{e.zh}</div>
        {e.note ? <div className="mn" style={{ marginTop: 6, opacity: 0.8 }}>{e.note}</div> : null}
      </div>
    );
  }
  // 词条型表达卡：链接进词条页吃内链长尾
  const inner = (
    <>
      <div className="term">{e.term}</div>
      <div className="tr" style={{ color: 'var(--accent2)', fontWeight: 600 }}>{e.translation}</div>
      <div className="mn">{e.meaning}</div>
      {e.example ? (
        <div className="mn" style={{ marginTop: 8 }}>
          {e.example}
          {e.exampleZh ? <span style={{ display: 'block', marginTop: 2 }}>{e.exampleZh}</span> : null}
        </div>
      ) : null}
    </>
  );
  if (e.slug && e.tags && e.tags.length > 0) {
    return (
      <Link className="entry-card" href={`/meme/${e.slug}`}>
        {inner}
      </Link>
    );
  }
  return <div className="entry-card">{inner}</div>;
}

export default async function SpeakScenarioPage({ params }: Props) {
  const { scenario: slug } = await params;
  const s = getSpeakScenario(slug);
  if (!s) notFound();

  const others = SPEAK_SCENARIOS.filter((x) => x.slug !== s.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: s.h1,
          description: s.description,
          image: 'https://aifanyi.com/og-image.png',
          inLanguage: 'zh-CN',
          mainEntityOfPage: `https://aifanyi.com/speak/${s.slug}`,
          author: { '@type': 'Organization', name: '爱翻译 aifanyi.com', url: 'https://aifanyi.com/' },
          publisher: {
            '@type': 'Organization',
            name: '爱翻译 aifanyi.com',
            url: 'https://aifanyi.com/',
            logo: { '@type': 'ImageObject', url: 'https://aifanyi.com/og-image.png', width: 1200, height: 630 },
          },
        }) }}
      />

      <section className="hero">
        <h1>{s.h1}</h1>
        <p>{s.intro}</p>
      </section>

      {/* 首屏 top10 表达卡（蓝图：点击即看译文 → 词条类卡片直链词条页） */}
      <h2 className="section-title">{s.name}高频表达 TOP10</h2>
      <div className="entry-grid">
        {s.top10.map((e, i) => <EntryCard key={e.term + i} e={e} />)}
      </div>

      {/* 分块详解 */}
      {s.sections.map((sec) => (
        <section key={sec.title} style={{ marginTop: 36 }}>
          <h2 className="section-title">{sec.title}</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.9 }}>{sec.intro}</p>
          <div style={{ fontSize: 12, color: 'var(--muted)', opacity: 0.75, margin: '4px 0 12px' }}>数据来源：{sec.origin}</div>

          {sec.phrases && sec.phrases.length > 0 && (
            <div className="result" style={{ margin: '10px 0' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>实用短语 · 对照</div>
              {sec.phrases.map((p, i) => (
                <div key={i} style={{ marginTop: 8, paddingBottom: 8, borderBottom: '1px dashed var(--border)' }}>
                  <div style={{ fontWeight: 600 }}>{p.native}</div>
                  <div style={{ color: 'var(--muted)' }}>{p.zh}</div>
                  {p.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.note}</div>}
                </div>
              ))}
            </div>
          )}

          {sec.entries && sec.entries.length > 0 && (
            <div className="entry-grid">
              {sec.entries.map((e, i) => <EntryCard key={e.term + i} e={e} />)}
            </div>
          )}

          {sec.dialogue && (
            <div className="result" style={{ margin: '10px 0' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>场景对话 · {sec.dialogue.situation}</div>
              {sec.dialogue.lines.map((l, i) => (
                <div key={i} style={{ marginTop: 8 }}>
                  <div>{l.zh}</div>
                  <div style={{ color: 'var(--accent2)', fontSize: 14, marginTop: 2 }}>→ {l.en}</div>
                </div>
              ))}
            </div>
          )}

          {sec.links && sec.links.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
              {sec.links.map((l) => (
                <Link key={l.href + l.label} className="chip" href={l.href} title={l.desc || l.label}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* 工具 CTA（蓝图：场景化翻译入口，链 /#translator 锚点） */}
      <div className="cta-box" style={{ marginTop: 32, textAlign: 'center' }}>
        <a className="tool-cta" href="/#translator" style={{ background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
          {s.toolCtaLabel}
        </a>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
          {s.arenaLine} <Link href="/arena" style={{ color: 'var(--accent2)' }}>去擂台 →</Link>
        </p>
      </div>

      {/* 其他场景 */}
      <h2 className="section-title">其他场景</h2>
      <div className="entry-grid">
        {others.map((o) => (
          <Link key={o.slug} className="entry-card" href={`/speak/${o.slug}`}>
            <div className="term">{o.name}英语怎么说</div>
            <div className="mn">{o.sections.length} 个子场景 · {o.top10.length} 句高频表达</div>
          </Link>
        ))}
      </div>
    </>
  );
}
