import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { countryName, langName } from '@/lib/content/locales';

export const dynamic = 'force-dynamic';
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}


/** 菜单词条 SEO 页：/menu/[country]/[slug] */
export async function generateMetadata({ params }: { params: Promise<{ country: string; slug: string }> }): Promise<Metadata> {
  const { country, slug: rawSlug } = await params;
  const slug = safeDecode(rawSlug);
  const m = await prisma.menuEntry.findFirst({ where: { country, slug } }).catch(() => null);
  if (!m || m.status !== 'published') return { title: '菜单词典 | 爱翻译 aifanyi.com' };
  const roman = m.romanized ? `（${m.romanized}）` : '';
  const en = m.en ? ` / ${m.en}` : '';
  return {
    title: `${m.zh}${roman}是什么菜？${m.zh}${en} · ${countryName(country)}菜单翻译 | 爱翻译`,
    description: `${m.zh}${roman}（${countryName(country)}菜单）是${m.description || m.dish || '一道当地菜'}。${m.en ? `英文名 ${m.en}。` : ''}爱翻译 · AI翻译。`,
  };
}

export default async function MenuEntryPage({ params }: { params: Promise<{ country: string; slug: string }> }) {
  const { country, slug: rawSlug } = await params;
  const slug = safeDecode(rawSlug);
  const m = await prisma.menuEntry.findFirst({ where: { country, slug } });
  if (!m || m.status !== 'published') notFound();

  const pairings = (m.pairings as unknown as { zh: string; en?: string }[] | null) || null;
  const tags = (m.tags as string[]) || [];

  let related: { slug: string; zh: string; en: string | null }[] = [];
  try {
    const raw = await prisma.menuEntry.findMany({
      where: { status: 'published', country },
      orderBy: { popularity: 'desc' },
      take: 8,
      select: { slug: true, zh: true, en: true },
    });
    related = raw.filter((r) => r.slug !== m.slug).slice(0, 6);
  } catch {
    // 相关查询失败不影响主内容
  }

  return (
    <>
      <h1>{m.zh} 是什么菜？</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": `${m.zh}是什么菜？${m.en ? `${m.en} · ` : ''}${countryName(country)}菜单翻译`,
          "description": m.description || `${m.zh}（${countryName(country)}菜单）菜品翻译。`,
          "image": "https://aifanyi.com/og-image.png",
          "datePublished": m.createdAt,
          "dateModified": m.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/menu/${m.country}/${m.slug}`,
          "author": { "@type": "Organization", "name": "爱翻译 aifanyi.com", "url": "https://aifanyi.com/" },
          "publisher": {
            "@type": "Organization", "name": "爱翻译", "url": "https://aifanyi.com/",
            "logo": { "@type": "ImageObject", "url": "https://aifanyi.com/og-image.png", "width": 1200, "height": 630 },
          },
        }) }}
      />

      <p style={{ color: 'var(--muted)' }}>{countryName(country)}菜单 · 看懂菜名，点对菜</p>

      <div className="translator-box" style={{ maxWidth: 'none' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>中文菜名</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent2)', margin: '6px 0' }}>{m.zh}</div>
        {m.romanized && <div style={{ fontSize: 14, color: 'var(--muted)' }}>{m.romanized}</div>}
        {m.en && <div style={{ fontSize: 14, color: 'var(--muted)' }}>{m.en}</div>}
        {m.lang && m.lang !== 'zh-CN' && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>原文语言：{langName(m.lang)}</div>}
      </div>

      {m.description && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>菜品介绍</div>
          <div style={{ marginTop: 2 }}>{m.description}</div>
        </div>
      )}

      {pairings && pairings.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>常见搭配</div>
          {pairings.map((p, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <div>{p.zh}{p.en ? `（${p.en}）` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div style={{ margin: '10px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((t) => (
            <span key={t} style={{ background: 'var(--border, #e5e7eb)', borderRadius: 12, padding: '2px 10px', fontSize: 12, color: 'var(--muted)' }}>{t}</span>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <>
          <h2 className="section-title">更多{countryName(country)}菜单</h2>
          <div className="entry-grid">
            {related.map((r) => (
              <Link key={r.slug} className="entry-card" href={`/menu/${m.country}/${r.slug}`}>
                <div className="term">{r.zh}</div>
                <div className="tr">{r.en || countryName(country)}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>看到陌生菜名？拍照上传图片翻译，或直接使用 AI 翻译工作台。</p>
        <a href="/tools/image-translator" className="btn primary">拍菜单翻译</a>
      </div>
    </>
  );
}
