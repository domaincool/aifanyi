import type { MetadataRoute } from 'next';
import { TRANSLATE_PAIRS } from '@/lib/translate-pairs';
import { SPEAK_SCENARIOS } from '@/lib/content/speak-scenarios';
import { CULTURE_ARTICLES } from '@/lib/content/culture-articles';
import { prisma } from '@/lib/db';

/**
 * /sitemap.xml —— 静态页 + 语言对（分组方案 A：主图瘦身为小文件）
 * 词条详情页（4800+ URL，DB 驱动）迁移至 /sitemaps/content.xml（见 src/app/sitemaps/[group]/route.ts）
 * robots.txt 同时声明两个 sitemap，Google/Bing 均支持多 sitemap 声明
 *
 * __p0lastmod__ lastmod 真实化：DB 驱动栏目页读各表 max(updatedAt)；纯静态页省略 lastmod
 * （假 lastmod 比缺失更有害——Google 只在 lastmod 持续准确时才采信，全站同日刷新会被判定低质量信号）
 */
export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com';

async function maxUpdated(
  model: 'memeEntry' | 'phraseEntry' | 'expressionEntry' | 'menuEntry' | 'recipeEntry' | 'sceneEntry',
  where?: Record<string, unknown>,
): Promise<Date | null> {
  try {
    const row = await (prisma as any)[model].findFirst({
      where: { status: 'published', ...(where || {}) },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return row?.updatedAt || null;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [memeMax, phraseMax, exprIdiomMax, exprUntrMax, menuMax, recipeMax, sceneTravelMax, sceneLifeMax] = await Promise.all([
    maxUpdated('memeEntry'),
    maxUpdated('phraseEntry'),
    maxUpdated('expressionEntry', { type: 'idiom' }),
    maxUpdated('expressionEntry', { type: 'untranslatable' }),
    maxUpdated('menuEntry'),
    maxUpdated('recipeEntry'),
    maxUpdated('sceneEntry', { kind: 'travel' }),
    maxUpdated('sceneEntry', { kind: 'life' }),
  ]);
  // /understand 是聚合栏目：任一子库更新都算栏目更新
  const understandMax = [memeMax, phraseMax, exprIdiomMax, exprUntrMax]
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  // lastModified 传 undefined 时 Next 会省略 <lastmod> 节点（静态页无新鲜度信号，优于假日期）
  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/tools`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/solutions`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/credit`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/voice`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/updates`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/arena`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/meme`, lastModified: memeMax || undefined, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/idioms`, lastModified: exprIdiomMax || undefined, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/untranslatable`, lastModified: exprUntrMax || undefined, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/menu`, lastModified: menuMax || undefined, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/culture`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/speak`, changeFrequency: 'weekly', priority: 0.8 },
    ...SPEAK_SCENARIOS.map((s) => ({ url: `${BASE}/speak/${s.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...CULTURE_ARTICLES.map((a) => ({ url: `${BASE}/culture/${a.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: `${BASE}/life`, lastModified: sceneLifeMax || undefined, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/travel`, lastModified: sceneTravelMax || undefined, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/recipes`, lastModified: recipeMax || undefined, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/expressions`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/understand`, lastModified: understandMax || undefined, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/understand/meaning`, lastModified: memeMax || undefined, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/understand/say`, lastModified: phraseMax || undefined, changeFrequency: 'daily', priority: 0.9 },
    ...TRANSLATE_PAIRS.map((p) => ({ url: `${BASE}/translate/${p.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    { url: `${BASE}/tools/pdf-translator`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/subtitle-translator`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/ai-polish`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/image-translator`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/web-translator`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/doc-translator`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/languages/japanese`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/korean`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/english`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/french`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/german`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/italian`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/thai`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/russian`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/portuguese`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/polish`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/hindi`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/vietnamese`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/spanish`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/turkish`, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
