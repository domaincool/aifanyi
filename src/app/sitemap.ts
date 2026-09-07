import type { MetadataRoute } from 'next';
import { TRANSLATE_PAIRS } from '@/lib/translate-pairs';

/**
 * /sitemap.xml —— 静态页 + 语言对（分组方案 A：主图瘦身为小文件）
 * 词条详情页（1070+ URL，DB 驱动）迁移至 /sitemaps/content.xml（见 src/app/sitemaps/[group]/route.ts）
 * robots.txt 同时声明两个 sitemap，Google/Bing 均支持多 sitemap 声明
 */
export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/solutions`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
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
    ...TRANSLATE_PAIRS.map((p) => ({ url: `${BASE}/translate/${p.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    { url: `${BASE}/tools/pdf-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/subtitle-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/ai-polish`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/image-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/web-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/tools/doc-translator`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/languages/vietnamese`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/spanish`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/languages/turkish`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
