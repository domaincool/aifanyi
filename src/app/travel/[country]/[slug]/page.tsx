import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { countryName, langName } from '@/lib/content/locales';

export const dynamic = 'force-dynamic';

interface Phrase { zh: string; native?: string; pronounce?: string; polite?: string; en?: string; usage?: string }
interface Tip { zh: string; en?: string }

/** 旅行场景 SEO 页：/travel/[country]/[slug] */
export async function generateMetadata({ params }: { params: Promise<{ country: string; slug: string }> }): Promise<Metadata> {
  const { country, slug } = await params;
  const s = await prisma.sceneEntry.findFirst({ where: { country, slug } }).catch(() => null);
  if (!s || s.status !== 'published') return { title: '旅行语言 | 爱翻译 aifanyi.com' };
  return {
    title: `${s.title} · ${countryName(country)}旅行常用语 | 爱翻译`,
    description: `${s.intro || `${s.title}——${countryName(country)}旅行场景必备用语。`}含${(s.phrases as unknown[] | null) && Array.isArray(s.phrases) ? (s.phrases as unknown[]).length : 0}句实用短语对照，爱翻译 · AI翻译。`,
  };
}

export default async function TravelScenePage({ params }: { params: Promise<{ country: string; slug: string }> }) {
  const { country, slug } = await params;
  const s = await prisma.sceneEntry.findFirst({ where: { country, slug } });
  if (!s || s.status !== 'published') notFound();

  const phrases = (s.phrases as unknown as Phrase[]) || [];
  const tips = (s.tips as unknown as Tip[] | null) || null;
  const cautions = (s.cautions as unknown as string[] | null) || null;
  const relatedSlugs = (s.related as unknown as string[] | null) || null;

  let related: { slug: string; title: string }[] = [];
  try {
    const raw = await prisma.sceneEntry.findMany({
      where: { status: 'published', country, kind: s.kind },
      orderBy: { popularity: 'desc' },
      take: 8,
      select: { slug: true, title: true },
    });
    related = raw.filter((r) => r.slug !== s.slug).slice(0, 6);
  } catch {
    // 相关查询失败不影响主内容
  }

  return (
    <>
      <h1>{s.title}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": `${s.title} · ${countryName(country)}旅行常用语`,
          "description": s.intro || `${s.title}——${countryName(country)}旅行场景必备用语。`,
          "image": "https://aifanyi.com/og-image.png",
          "datePublished": s.createdAt,
          "dateModified": s.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/travel/${s.country}/${s.slug}`,
          "author": { "@type": "Organization", "name": "爱翻译 aifanyi.com", "url": "https://aifanyi.com/" },
          "publisher": {
            "@type": "Organization", "name": "爱翻译", "url": "https://aifanyi.com/",
            "logo": { "@type": "ImageObject", "url": "https://aifanyi.com/og-image.png", "width": 1200, "height": 630 },
          },
        }) }}
      />

      <p style={{ color: 'var(--muted)' }}>{countryName(country)}旅行 · {langName(s.lang) || '当地语言'} · {s.kind === 'life' ? '生活场景' : '旅行场景'}</p>

      {s.intro && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>场景介绍</div>
          <div style={{ marginTop: 2 }}>{s.intro}</div>
        </div>
      )}

      {phrases.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>实用短语 · 对照</div>
          {phrases.map((p, i) => (
            <div key={i} style={{ marginTop: 6, paddingBottom: 6, borderBottom: '1px dashed var(--border, #e5e7eb)' }}>
              {p.native && <div>{p.native}</div>}
              {!p.native && p.en && <div>{p.en}</div>}
              <div style={{ color: 'var(--muted)' }}>{p.zh}</div>
              {p.pronounce && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.pronounce}</div>}
              {p.polite && <span style={{ display: 'inline-block', background: 'var(--border, #e5e7eb)', borderRadius: 10, padding: '1px 8px', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{p.polite === 'polite' ? '礼貌用语' : p.polite === 'casual' ? '口语' : p.polite}</span>}
              {p.usage && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>用法：{p.usage}</div>}
            </div>
          ))}
        </div>
      )}

      {tips && tips.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>小贴士</div>
          {tips.map((t, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <div>{t.zh}{t.en ? `（${t.en}）` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {cautions && cautions.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>注意事项</div>
          {cautions.map((c, i) => (
            <div key={i} style={{ marginTop: 4 }}>⚠️ {c}</div>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <>
          <h2 className="section-title">更多{countryName(country)}旅行场景</h2>
          <div className="entry-grid">
            {related.map((r) => (
              <Link key={r.slug} className="entry-card" href={`/travel/${s.country}/${r.slug}`}>
                <div className="term">{r.title}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>到了当地还有不会说的？打开 AI 翻译工作台，实时语音互译。</p>
        <a href="/voice" className="btn primary">语音翻译</a>
      </div>
    </>
  );
}
