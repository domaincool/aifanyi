import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    // 双 sitemap 声明（蓝图 P0-5）：主图（静态页）+ 内容图（词条详情页，DB 驱动）
    sitemap: [`${BASE}/sitemap.xml`, `${BASE}/sitemaps/content.xml`],
  };
}
