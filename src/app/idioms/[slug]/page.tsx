import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/** 成语/谚语词条 SEO 页：/idioms/[slug]，每词一页吃长尾搜索词 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = await prisma.expressionEntry.findUnique({ where: { slug } }).catch(() => null);
  if (!e || e.status !== 'published') return { title: '成语谚语翻译 | 爱翻译 aifanyi.com' };
  return {
    title: `${e.term} 用英语怎么说？${e.term} → ${e.translation} | 爱翻译`,
    description: `${e.term}（${e.meaning}）的地道英文表达是「${e.translation}」。含拼音、直译、例句与使用场景，爱翻译 · AI翻译。`,
  };
}

export default async function IdiomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await prisma.expressionEntry.findUnique({ where: { slug } });
  if (!e || e.status !== 'published') notFound();

  const multiLang = (e.multiLang as Record<string, string> | null) || null;
  const tags = (e.tags as string[]) || [];

  let related: { slug: string; term: string; translation: string }[] = [];
  try {
    if (tags.length > 0) {
      const raw = await prisma.expressionEntry.findMany({
        where: { status: 'published', type: 'idiom', tags: { hasSome: tags } },
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
  if (e.literal) blocks.push({ label: '直译', value: e.literal });
  const examples = (e.examples as { zh: string; en: string }[] | null) || null;
  if (e.usage) blocks.push({ label: '使用场景', value: e.usage });
  if (e.note) blocks.push({ label: '常见误译', value: e.note });
  if (e.source) blocks.push({ label: '出处', value: e.source });
  if (e.culture) blocks.push({ label: '文化背景', value: e.culture });

  return (
    <>
      <h1>{e.term} 用英语怎么说？</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": `${e.term} 用英语怎么说？${e.term} → ${e.translation}`,
          "description": `${e.term}（${e.meaning}）的地道英文表达是「${e.translation}」。`,
          "datePublished": e.createdAt,
          "dateModified": e.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": `https://aifanyi.com/idioms/${e.slug}`,
          "author": { "@type": "Organization", "name": "爱翻译 aifanyi.com", "url": "https://aifanyi.com/" },
          "publisher": {
            "@type": "Organization", "name": "爱翻译", "url": "https://aifanyi.com/",
            "logo": { "@type": "ImageObject", "url": "https://aifanyi.com/og-image.png", "width": 1200, "height": 630 },
          },
        }) }}
      />

      <p style={{ color: 'var(--muted)' }}>{e.meaning}</p>

      <div className="translator-box" style={{ maxWidth: 'none' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>地道表达</div>
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

      {multiLang && Object.keys(multiLang).length > 0 && (
        <>
          <h2 className="section-title">多语言版本</h2>
          <div className="entry-grid">
            {Object.entries(multiLang).map(([lang, val]) => (
              <div key={lang} className="entry-card">
                <div className="term">{lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : lang === 'ko' ? '한국어' : lang}</div>
                <div className="tr">{String(val)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <>
          <h2 className="section-title">相关成语 · 同类表达</h2>
          <div className="entry-grid">
            {related.map((r) => (
              <Link key={r.slug} className="entry-card" href={`/idioms/${r.slug}`}>
                <div className="term">{r.term}</div>
                <div className="tr">{r.translation}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>还有一句想翻？试试把这句成语翻成别的语言，或直接使用 AI 翻译工作台。</p>
        <a href="/" className="btn primary">去翻译</a>
      </div>
    </>
  );
}
