import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

/** 梗词条 SEO 页：/meme/[slug]，每词一页吃长尾搜索词 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = await prisma.memeEntry.findUnique({ where: { slug } }).catch(() => null);
  if (!m || m.status !== 'published') return { title: '网络用语翻译 | 爱翻译 aifanyi.com' };
  return {
    title: `${m.term} 英文怎么说？${m.term} → ${m.translation} | 爱翻译`,
    description: `${m.term}（${m.meaning}）的地道英文表达是「${m.translation}」。含例句与使用场景，爱翻译 · AI翻译。`,
  };
}

export default async function MemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await prisma.memeEntry.findUnique({ where: { slug } });
  if (!m || m.status !== 'published') notFound();

  const examples = (m.examples as { zh: string; en: string }[]) || [];
  const tags = (m.tags as string[]) || [];
  // 相关梗：同 tag 的其他词条，站内互链吃长尾流量
  let related: { slug: string; term: string; translation: string }[] = [];
  try {
    if (tags.length > 0) {
      const raw = await prisma.memeEntry.findMany({
        where: { status: "published", tags: { hasSome: tags } },
        orderBy: { popularity: "desc" },
        take: 8,
        select: { slug: true, term: true, translation: true },
      });
      related = raw.filter((r) => r.slug !== m.slug).slice(0, 6);
    }
  } catch {
    // 相关梗查询失败不影响主内容
  }

  return (
    <>
      <h1>{m.term} 用英语怎么说？</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": m.term + " 用英语怎么说？" + m.term + " → " + m.translation,
          "description": m.term + "（" + m.meaning + "）的地道英文表达是「" + m.translation + "」。含例句与使用场景，爱翻译 · AI翻译。",
          "datePublished": m.createdAt,
          "dateModified": m.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": "https://aifanyi.com/meme/" + m.slug,
          "author": {
            "@type": "Organization",
            "name": "爱翻译 aifanyi.com",
            "url": "https://aifanyi.com/"
          },
          "publisher": {
            "@type": "Organization",
            "name": "爱翻译",
            "url": "https://aifanyi.com/",
            "logo": {
              "@type": "ImageObject",
              "url": "https://aifanyi.com/og-image.png",
              "width": 1200,
              "height": 630
            }
          }
        }) }}
      />

      <p style={{ color: 'var(--muted)' }}>{m.meaning}</p>

      <div className="translator-box" style={{ maxWidth: 'none' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>地道表达</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent2)', margin: '6px 0' }}>{m.translation}</div>
      </div>

      {examples.length > 0 && (
        <>
          <h2 className="section-title">例句</h2>
          {examples.map((ex, i) => (
            <div key={i} className="result" style={{ margin: '10px 0' }}>
              <div>{ex.en}</div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>{ex.zh}</div>
            </div>
          ))}
        </>
      )}

      {related.length > 0 && (
        <>
          <h2 className="section-title">相关梗 · 同类网络用语</h2>
          <div className="entry-grid">
            {related.map((r) => (
              <a key={r.slug} className="entry-card" href={"/meme/" + r.slug}>
                <div className="term">{r.term}</div>
                <div className="tr">{r.translation}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {tags.length > 0 && (
        <p style={{ marginTop: 16 }}>
          {tags.map((t) => (
            <a key={t} className="chip" href={"/meme/tag/" + encodeURIComponent(t)} style={{ marginRight: 8 }}>
              {"#" + t}
            </a>
          ))}
        </p>
      )}
      <p style={{ marginTop: 24, color: 'var(--muted)' }}>
        还想翻别的梗？试试首页的<a href="/" style={{ color: 'var(--accent2)' }}>翻译框</a>，或去<a href="/blindtest" style={{ color: 'var(--accent2)' }}>盲测擂台</a>看看哪家 AI 最强。
      </p>
    </>
  );
}
