import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

// 动态生成 sitemap：每次请求从数据库读取词条，加新词条自动出现在地图里
export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/english-to-chinese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/chinese-to-english`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/japanese-to-chinese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/korean-to-chinese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/chinese-to-japanese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/chinese-to-korean`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/french-to-chinese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/german-to-chinese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/translate/russian-to-chinese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/tools/pdf-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/subtitle-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/ai-polish`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/image-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/web-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/doc-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
{ url: `${BASE}/credit`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/voice`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/updates`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blindtest`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/meme`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/idioms`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/untranslatable`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/menu`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/culture`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/life`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/travel`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/recipes`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/expressions`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];

  // 200 个梗词条 SEO 页
  let memes: { slug: string; updatedAt: Date }[] = [];
  try {
    memes = await prisma.memeEntry.findMany({ where: { status: 'published' }, select: { slug: true, updatedAt: true } });
  } catch {
    // 数据库暂不可用时只返回基础页，不让 sitemap 挂掉
  }

  for (const m of memes) {
    entries.push({
      url: `${BASE}/meme/${m.slug}`,
      lastModified: m.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // 成语谚语词条 SEO 页
  let idioms: { slug: string; updatedAt: Date }[] = [];
  try {
    idioms = await prisma.expressionEntry.findMany({ where: { status: 'published', type: 'idiom' }, select: { slug: true, updatedAt: true } });
  } catch {
    // 数据库暂不可用时只返回基础页
  }
  for (const i of idioms) {
    entries.push({
      url: `${BASE}/idioms/${i.slug}`,
      lastModified: i.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // 难翻译词词条 SEO 页
  let untrans: { slug: string; updatedAt: Date }[] = [];
  try {
    untrans = await prisma.expressionEntry.findMany({ where: { status: 'published', type: 'untranslatable' }, select: { slug: true, updatedAt: true } });
  } catch {
    // 数据库暂不可用时只返回基础页
  }
  for (const u of untrans) {
    entries.push({
      url: `${BASE}/untranslatable/${u.slug}`,
      lastModified: u.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // 菜单词条 SEO 页（双段路由）
  let menus: { slug: string; country: string; updatedAt: Date }[] = [];
  try {
    menus = await prisma.menuEntry.findMany({ where: { status: 'published' }, select: { slug: true, country: true, updatedAt: true } });
  } catch {
    // 忽略
  }
  for (const mn of menus) {
    entries.push({
      url: `${BASE}/menu/${mn.country}/${mn.slug}`,
      lastModified: mn.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // 旅行/生活场景 SEO 页（双段路由）
  let scenes: { slug: string; country: string; updatedAt: Date }[] = [];
  try {
    scenes = await prisma.sceneEntry.findMany({ where: { status: 'published' }, select: { slug: true, country: true, updatedAt: true } });
  } catch {
    // 忽略
  }
  for (const sc of scenes) {
    entries.push({
      url: `${BASE}/travel/${sc.country}/${sc.slug}`,
      lastModified: sc.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // 菜谱 SEO 页
  let recipes: { slug: string; updatedAt: Date }[] = [];
  try {
    recipes = await prisma.recipeEntry.findMany({ where: { status: 'published' }, select: { slug: true, updatedAt: true } });
  } catch {
    // 忽略
  }
  for (const rc of recipes) {
    entries.push({
      url: `${BASE}/recipes/${rc.slug}`,
      lastModified: rc.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }


  // /meme/tag/xxx 分类聚合页（V1.2 SEO，?tag= 升级为路由）
  let tagRows: { tag: string }[] = [];
  try {
    tagRows = await prisma.$queryRaw<{ tag: string }[]>`SELECT DISTINCT unnest(tags) AS tag FROM "MemeEntry" WHERE status = 'published'`;
  } catch {
    // 忽略
  }
  for (const tr of tagRows) {
    entries.push({
      url: `${BASE}/meme/tag/${encodeURIComponent(tr.tag)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }
  return entries;
}
