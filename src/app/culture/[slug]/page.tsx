import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { CULTURE_ARTICLES, getCultureArticle } from '@/lib/content/culture-articles';

/**
 * 模板 F：Explore 文化页 /culture/[slug]（蓝图 3.5.6）
 * generateStaticParams 白名单 3 篇 + dynamicParams=false；Schema：Article
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return CULTURE_ARTICLES.map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = getCultureArticle(slug);
  if (!a) return {};
  return buildMetadata({
    path: `/culture/${a.slug}`,
    title: a.title,
    description: a.description,
    keywords: a.keywords,
    ogType: 'content',
    ogTitle: a.h1,
  });
}

export default async function CultureArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = getCultureArticle(slug);
  if (!a) notFound();

  const others = CULTURE_ARTICLES.filter((x) => x.slug !== a.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.h1,
          description: a.description,
          image: 'https://aifanyi.com/og-image.png',
          inLanguage: 'zh-CN',
          mainEntityOfPage: `https://aifanyi.com/culture/${a.slug}`,
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
        <h1>{a.h1}</h1>
      </section>

      {/* 首屏快答：一句话定义 + 高频误解 */}
      <div className="short-answer">
        <div className="sa-label">一句话定义</div>
        <div className="sa-text">{a.oneLiner}</div>
      </div>
      <div className="result" style={{ margin: '10px 0' }}>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>高频误解</div>
        <div style={{ marginTop: 4, lineHeight: 1.9 }}>{a.misconception}</div>
      </div>

      {/* 详解：3-5 个文化子点（每点配语言现象实例） */}
      {a.points.map((p) => (
        <section key={p.title} style={{ marginTop: 32 }}>
          <h2 className="section-title">{p.title}</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.9 }}>{p.body}</p>
          {p.examples.length > 0 && (
            <div className="result" style={{ margin: '10px 0' }}>
              {p.examples.map((ex, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 0 : 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{ex.label}</div>
                  <div style={{ marginTop: 2, lineHeight: 1.8 }}>{ex.text}</div>
                </div>
              ))}
            </div>
          )}
          {p.links && p.links.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
              {p.links.map((l) => (
                <Link key={l.href + l.label} className="chip" href={l.href}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* 例句：文化冲突场景对话 ×2 */}
      <h2 className="section-title">文化冲突现场 · 对话</h2>
      {a.dialogues.map((d, i) => (
        <div key={i} className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{d.situation}</div>
          {d.lines.map((l, j) => (
            <div key={j} style={{ marginTop: 8 }}>
              <div>{l.zh}</div>
              <div style={{ color: 'var(--accent2)', fontSize: 14, marginTop: 2 }}>→ {l.en}</div>
            </div>
          ))}
        </div>
      ))}

      {/* 工具 CTA（蓝图：「遇到看不懂的 → 图片/网页翻译」） */}
      <div className="cta-box" style={{ marginTop: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>遇到看不懂的外文菜单、路牌、网页？</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <a className="tool-cta" href="/tools/image-translator" style={{ background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
            📷 拍下看不懂的外文 →
          </a>
          <a className="tool-cta" href="/tools/web-translator" style={{ background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
            🌐 网页翻译
          </a>
          <a className="tool-cta" href="/#translator" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
            文本翻译 →
          </a>
        </div>
      </div>

      {/* 栏目级内链 + 其他文章 */}
      <h2 className="section-title">继续探索</h2>
      <div className="entry-grid">
        {others.map((o) => (
          <Link key={o.slug} className="entry-card" href={`/culture/${o.slug}`}>
            <div className="term">{o.h1.split('：')[0]}</div>
            <div className="mn">{o.oneLiner.slice(0, 48)}…</div>
          </Link>
        ))}
        {a.relatedLinks.map((l) => (
          <Link key={l.href + l.label} className="entry-card" href={l.href}>
            <div className="term">{l.label}</div>
            {l.desc ? <div className="mn">{l.desc}</div> : null}
          </Link>
        ))}
      </div>
    </>
  );
}
