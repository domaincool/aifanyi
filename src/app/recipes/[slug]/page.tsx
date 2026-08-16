import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { countryName } from '@/lib/content/locales';

export const dynamic = 'force-dynamic';
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}


function toIsoDuration(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d+)\s*小时/);
  const mm = raw.match(/(\d+)\s*分钟/);
  const h = m ? parseInt(m[1], 10) : 0;
  const min = mm ? parseInt(mm[1], 10) : 0;
  if (h === 0 && min === 0) return undefined;
  let out = 'PT';
  if (h > 0) out += h + 'H';
  if (min > 0) out += min + 'M';
  return out;
}

interface Ingredient { name: string; amount?: string }
interface Step { text: string }
interface Vocab { zh: string; en?: string }

/** 菜谱 SEO 页：/recipes/[slug]，JSON-LD Recipe */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = safeDecode(rawSlug);
  const r = await prisma.recipeEntry.findFirst({ where: { slug } }).catch(() => null);
  if (!r || r.status !== 'published') return { title: '全球美食菜谱 | 爱翻译 aifanyi.com' };
  const en = r.enName ? `（${r.enName}）` : '';
  return {
    title: `${r.zhName || r.dish}怎么做？${r.zhName || r.dish}${en}家常菜谱 | 爱翻译`,
    description: `${r.zhName || r.dish}${en}的做法：${((r.ingredients as unknown as Ingredient[]) || []).length} 种食材，${((r.steps as unknown as Step[]) || []).length} 步完成${r.difficulty ? `，难度${r.difficulty}` : ''}。${r.intro || ''}爱翻译 · AI翻译。`,
  };
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await prisma.recipeEntry.findFirst({ where: { slug } });
  if (!r || r.status !== 'published') notFound();

  const ingredients = (r.ingredients as unknown as Ingredient[]) || [];
  const steps = (r.steps as unknown as Step[]) || [];
  const vocab = (r.vocab as unknown as Vocab[] | null) || null;
  const misTranslated = (r.misTranslated as unknown as { wrong: string; right: string; why?: string }[] | null) || null;

  let related: { slug: string; zhName: string | null; dish: string }[] = [];
  try {
    const raw = await prisma.recipeEntry.findMany({
      where: { status: 'published', country: r.country || undefined },
      orderBy: { popularity: 'desc' },
      take: 8,
      select: { slug: true, zhName: true, dish: true },
    });
    related = raw.filter((x) => x.slug !== r.slug).slice(0, 6);
  } catch {
    // 相关查询失败不影响主内容
  }

  const meta: Record<string, string> = {};
  if (r.cookTime) meta['烹饪时间'] = r.cookTime;
  if (r.difficulty) meta['难度'] = r.difficulty;
  if (r.servings) meta['份量'] = `${r.servings} 人份`;
  if (r.category) meta['类别'] = r.category;

  return (
    <>
      <h1>{r.zhName || r.dish} 怎么做？</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Recipe",
          "name": r.zhName || r.dish,
          "description": r.intro || `${r.zhName || r.dish}家常做法。`,
          "recipeCategory": r.category || undefined,
          "recipeCuisine": r.country ? countryName(r.country) : undefined,
          "cookTime": toIsoDuration(r.cookTime),
          "recipeYield": r.servings ? `${r.servings}` : undefined,
          "recipeIngredient": ingredients.length > 0 ? ingredients.map((i) => (i.amount ? `${i.amount} ${i.name}` : i.name)) : undefined,
          "recipeInstructions": steps.length > 0 ? steps.map((s, i) => ({ "@type": "HowToStep", "position": i + 1, "text": s.text })) : undefined,
          "image": "https://aifanyi.com/og-image.png",
          "datePublished": r.createdAt,
          "dateModified": r.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/recipes/${r.slug}`,
          "author": { "@type": "Organization", "name": "爱翻译 aifanyi.com", "url": "https://aifanyi.com/" },
          "publisher": {
            "@type": "Organization", "name": "爱翻译", "url": "https://aifanyi.com/",
            "logo": { "@type": "ImageObject", "url": "https://aifanyi.com/og-image.png", "width": 1200, "height": 630 },
          },
        }) }}
      />

      <p style={{ color: 'var(--muted)' }}>
        {r.country ? `${countryName(r.country)}风味` : '家常菜'} · {r.zhName && r.dish && r.zhName !== r.dish ? `${r.dish} / ` : ''}{r.enName ? `${r.enName}` : ''}
      </p>

      {r.intro && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>菜品介绍</div>
          <div style={{ marginTop: 2 }}>{r.intro}</div>
        </div>
      )}

      <div className="translator-box" style={{ maxWidth: 'none' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>菜名</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent2)', margin: '6px 0' }}>{r.zhName || r.dish}</div>
        {r.enName && <div style={{ fontSize: 14, color: 'var(--muted)' }}>{r.enName}</div>}
        {Object.keys(meta).length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(meta).map(([k, v]) => (
              <span key={k} style={{ background: 'var(--border, #e5e7eb)', borderRadius: 12, padding: '2px 10px', fontSize: 12, color: 'var(--muted)' }}>{k}：{v}</span>
            ))}
          </div>
        )}
      </div>

      {ingredients.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>食材</div>
          {ingredients.map((i, idx) => (
            <div key={idx} style={{ marginTop: 3 }}>
              {i.amount ? `${i.amount} ${i.name}` : i.name}
            </div>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>做法</div>
          {steps.map((s, idx) => (
            <div key={idx} style={{ marginTop: 5, display: 'flex', gap: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent2)' }}>{idx + 1}.</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}

      {vocab && vocab.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>烹饪词汇 · 中英对照</div>
          {vocab.map((v, i) => (
            <div key={i} style={{ marginTop: 3 }}>
              {v.zh}{v.en ? ` → ${v.en}` : ''}
            </div>
          ))}
        </div>
      )}

      {misTranslated && misTranslated.length > 0 && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>常见误译</div>
          {misTranslated.map((x, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <div><s style={{ color: 'var(--muted)' }}>{x.wrong}</s> → <b>{x.right}</b></div>
              {x.why && <div style={{ color: 'var(--muted)' }}>{x.why}</div>}
            </div>
          ))}
        </div>
      )}

      {r.culture && (
        <div className="result" style={{ margin: '10px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>文化背景</div>
          <div style={{ marginTop: 2 }}>{r.culture}</div>
        </div>
      )}

      {related.length > 0 && (
        <>
          <h2 className="section-title">更多菜谱</h2>
          <div className="entry-grid">
            {related.map((x) => (
              <Link key={x.slug} className="entry-card" href={`/recipes/${x.slug}`}>
                <div className="term">{x.zhName || x.dish}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>这道菜做法看不懂？把外文菜谱上传 PDF 翻译，或使用 AI 翻译工作台。</p>
        <a href="/tools/pdf-translator" className="btn primary">翻译菜谱</a>
      </div>
    </>
  );
}
