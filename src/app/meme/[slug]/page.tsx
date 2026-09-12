import { prisma } from '@/lib/db';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { recordContentView } from '@/lib/metrics/server';
import { cookies } from 'next/headers';
import ToolCtaButton from '@/components/ToolCtaButton';
import ContentScrollTracker from '@/components/ContentScrollTracker';

export const dynamic = 'force-dynamic';

/** 梗词条 SEO 页：/meme/[slug]，每词一页吃长尾搜索词 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = await prisma.memeEntry.findUnique({ where: { slug } }).catch(() => null);
  if (!m || m.status !== 'published') return { title: '网络用语翻译 | 爱翻译 aifanyi.com' };
  const isEn = m.lang === 'en';
  return buildMetadata({
    // __p0mb__ en 词条 canonical 指稳定 Meaning URL
    path: isEn ? `/understand/meaning/${m.slug}` : `/meme/${m.slug}`,
    title: isEn
      ? `${m.term} 中文什么意思？${m.term} → ${m.translation} | 爱翻译`
      : `${m.term} 英文怎么说？${m.term} → ${m.translation} | 爱翻译`,
    description: isEn
      ? `${m.term}（${m.meaning}）的中文意思是「${m.translation}」。含例句与使用场景，爱翻译 · AI翻译。`
      : `${m.term}（${m.meaning}）的地道英文表达是「${m.translation}」。含例句与使用场景，爱翻译 · AI翻译。`,
    ogType: 'content',
    ogTitle: isEn ? `${m.term} 是什么意思？→ ${m.translation}` : `${m.term} 用英语怎么说？→ ${m.translation}`,
  });
}

export default async function MemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await prisma.memeEntry.findUnique({ where: { slug } });
  if (!m || m.status !== 'published') notFound();
  // __p0meaning__ en 词条的稳定 URL 是 /understand/meaning/[slug]（Meaning SEO 层），meme URL 301 过去
  if (m.lang === 'en') permanentRedirect('/understand/meaning/' + m.slug);
  // 埋点（V1.0 D5）：词条页浏览计数 + 触点日志（P5 归因）
  recordContentView('meme', m.slug, (await cookies()).get('aifanyi_cs')?.value ?? null).catch(() => {});

  const examples = (m.examples as { zh: string; en: string }[]) || [];
  const isEn = m.lang === 'en';
  const tags = (m.tags as string[]) || [];
  // 相关梗：同 tag 的其他词条，站内互链吃长尾流量
  let related: { slug: string; term: string; translation: string }[] = [];
  try {
    // 内链引擎（V1.0 D15）：content_relation 语义关系优先，tags 共现兜底
    const rels = await prisma.contentRelation.findMany({
      where: { fromType: 'meme', fromId: m.id, relation: { in: ['similar', 'synonym', 'used_with', 'related_meme', 'derived_from'] } },
      orderBy: { weight: 'desc' },
      take: 8,
    });
    if (rels.length > 0) {
      const toIds = rels.map((r) => r.toId);
      const raw = await prisma.memeEntry.findMany({
        where: { id: { in: toIds }, status: 'published' },
        select: { id: true, slug: true, term: true, translation: true },
      });
      // 按 relation weight 排序（rels 顺序）
      const byId = new Map(raw.map((r: any) => [r.id ?? r.slug, r]));
      related = rels.map((r) => byId.get(r.toId)).filter(Boolean).slice(0, 6);
    }
    if (related.length === 0 && tags.length > 0) {
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
      <h1>{m.term}{isEn ? ' 中文什么意思？' : ' 用英语怎么说？'}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": m.term + (isEn ? " 中文什么意思？" : " 用英语怎么说？") + m.term + " → " + m.translation,
          "description": m.term + "（" + m.meaning + "）" + (isEn ? "的中文意思是「" + m.translation + "」" : "的地道英文表达是「" + m.translation + "」") + "。含例句与使用场景，爱翻译 · AI翻译。",
          "datePublished": m.createdAt,
          "dateModified": m.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": "https://aifanyi.com" + (isEn ? "/understand/meaning/" : "/meme/") + m.slug, // __p0mb__
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "QAPage",
          "mainEntity": {
            "@type": "Question",
            "name": m.term + (isEn ? " 中文什么意思？" : " 用英语怎么说？"),
            "text": m.term + "（" + m.meaning + "）" + (isEn ? "是什么意思？怎么翻译成中文？" : "怎么翻译成英语？"),
            "answerCount": 1,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": ((m.shortAnswer as string) || (m.term + "（" + m.meaning + "）" + (isEn ? "的中文意思是「" + m.translation + "」。" : "的地道英文表达是「" + m.translation + "」。")))
                + (examples.length > 0 ? " 例句：" + examples[0].en + "（" + examples[0].zh + "）。" : "")
                + " 更多网络用语翻译见爱翻译 aifanyi.com。",
              "url": "https://aifanyi.com/meme/" + m.slug
            }
          }
        }) }}
      />

      {(m.shortAnswer as string) && (
        <div className="short-answer">
          <div className="sa-label">一句话答案</div>
          <div className="sa-text">{m.shortAnswer as string}</div>
        </div>
      )}

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
      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToolCtaButton contentType="meme" contentId={m.slug} />
        <ContentScrollTracker contentType="meme" contentId={m.slug} />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>还想翻别的梗？去<a href="/arena" style={{ color: 'var(--accent2)' }}>擂台</a>看哪家 AI 最强。</span>
      </div>
    </>
  );
}
