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
    { url: `${BASE}/updates`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blindtest`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/meme`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ];

  // 200 个梗词条 SEO 页
  let memes: { slug: string; updatedAt: Date }[] = [];
  try {
    memes = await prisma.memeEntry.findMany({ select: { slug: true, updatedAt: true } });
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

  return entries;
}
