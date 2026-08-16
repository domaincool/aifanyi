import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/** 难翻译词 SEO 页：/untranslatable/[slug]，词条模板与 /idioms 同构（type 隔离） */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = await prisma.expressionEntry.findFirst({ where: { slug, type: 'untranslatable' } }).catch(() => null);
  if (!e || e.status !== 'published') return { title: '难翻译词 | 爱翻译 aifanyi.com' };
  return {
    title: `${e.term} 怎么翻译？${e.term} → ${e.translation} | 爱翻译`,
    description: `${e.term}（${e.meaning}）很难直译成英文——看它最接近的表达「${e.translation}」与用法。爱翻译 · AI翻译。`,
  };
}

export default async function UntranslatableEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await prisma.expressionEntry.findFirst({ where: { slug, type: 'untranslatable' } });
  if (!e || e.status !== 'published') notFound();

  const multiLang = (e.multiLang as { lang: string; text: string }[] | null) || null;
  const tags = (e.tags as string[]) || [];

  let related: { slug: string; term: string; translation: string }[] = [];
  try {
    if (tags.length > 0) {
      const raw = await prisma.expressionEntry.findMany({
        where: { status: 'published', type: 'untranslatable', tags: { hasSome: tags } },
        orderBy: { popularity: 'desc' },
        take: 8,
        select: { slug: true, term: true, translation: true },
      });
      related = raw.filter((r) => r.slug !== e.slug).slice(0, 6);
    }
  } catch {
    // 相关词条查询失败不影响主内容
  }

  const blocks: { label: string; value: string }[] = [];
  if (e.pinyin) blocks.push({ label: '拼音', value: e.pinyin });
  if (e.literal) blocks.push({ label: '字面意思', value: e.literal });
  const examples = (e.examples as { zh: string; en: string }[] | null) || null;
  if (e.usage) blocks.push({ label: '使用场景', value: e.usage });
  if (e.note) blocks.push({ label: '备注', value: e.note });
  if (e.source) blocks.push({ label: '出处', value: e.source });
  if (e.culture) blocks.push({ label: '文化背景', value: e.culture });

  return (
    <>
      <h1>{e.term} 怎么翻译？</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": `${e.term} 怎么翻译？${e.term} → ${e.translation}`,
          "description": `${e.term}（${e.meaning}）很难直译成英文，最接近的表达是「${e.translation}」。`,
          "image": "https://aifanyi.com/og-image.png",
          "datePublished": e.createdAt,
          "dateModified": e.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/untranslatable/${e.slug}`,
          "author": { "@type": "Organization", "name": "爱翻译 aifanyi.com", "url": "https://aifanyi.com/" },
          "publisher": {
            "@type": "Organization", "name": "爱翻译", "url": "https://aifanyi.com/",
            "logo": { "@type": "ImageObject", "url": "https://aifanyi.com/og-image.png", "width": 1200, "height": 630 },
          },
        }) }}
      />

      <p style={{ color: 'var(--muted)' }}>{e.meaning}</p>

      <div className="translator-box" style={{ maxWidth: 'none' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>最接近的表达</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent2)', margin: '6px 0' }}>{e.translation}</div>
        {e.pinyin && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{e.pinyin}</div>}
      </div>

      {examples && examples.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>例句</div>
          {examples.map((ex, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <div>{ex.en}</div>
              <div style={{ color: 'var(--muted)' }}>{ex.zh}</div>
            </div>
          ))}
        </div>
      )}

      {blocks.map((b) => (
        <div key={b.label} className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{b.label}</div>
          <div style={{ marginTop: 2 }}>{b.value}</div>
        </div>
      ))}

      {multiLang && multiLang.length > 0 && (
        <>
          <h2 className="section-title">多语言版本</h2>
          <div className="entry-grid">
            {multiLang.map((m) => (
              <div key={m.lang} className="entry-card">
                <div className="term">{m.lang}</div>
                <div className="tr">{m.text}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <>
          <h2 className="section-title">相关难翻译词</h2>
          <div className="entry-grid">
            {related.map((r) => (
              <Link key={r.slug} className="entry-card" href={`/untranslatable/${r.slug}`}>
                <div className="term">{r.term}</div>
                <div className="tr">{r.translation}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>这个词用法不确定？直接把它放进 AI 翻译工作台，看三种模型怎么翻。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </>
  );
}
