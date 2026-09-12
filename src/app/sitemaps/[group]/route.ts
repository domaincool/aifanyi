import { prisma } from '@/lib/db';
import { SITE_URL } from '@/lib/seo';

/**
 * 分组 sitemap（蓝图 P0-5 变体方案 A）
 *  /sitemaps/content.xml —— 全部词条详情页（meme/expression/scene/menu/recipe + meme tag 页，DB 驱动）
 *  未知分组 404（防任意路径生成）
 *  robots.txt 已同步声明本文件
 */
export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildXml(entries: { loc: string; lastmod?: Date }[]): string {
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const e of entries) {
    xml.push('  <url>', `    <loc>${esc(e.loc)}</loc>`);
    if (e.lastmod) xml.push(`    <lastmod>${e.lastmod.toISOString()}</lastmod>`);
    xml.push('  </url>');
  }
  xml.push('</urlset>');
  return xml.join('\n');
}

export async function GET(_req: Request, { params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  // 路径段可能是 'content' 或 'content.xml'（robots 引用带后缀形态）——统一去后缀
  const g = group.replace(/\.xml$/, '');

  if (g !== 'content') {
    return new Response('Not found', { status: 404 });
  }

  const entries: { loc: string; lastmod?: Date }[] = [];
  try {
    const memes = await prisma.memeEntry.findMany({ where: { status: 'published' }, select: { slug: true, lang: true, updatedAt: true } });
    for (const m of memes) {
      // __p0meaning__ en 词条走 /understand/meaning/[slug] 稳定 URL
      const prefix = m.lang === 'en' ? '/understand/meaning/' : '/meme/';
      entries.push({ loc: `${SITE_URL}${prefix}${m.slug}`, lastmod: m.updatedAt });
    }

    const exprs = await prisma.expressionEntry.findMany({ where: { status: 'published', type: { not: 'slang' } }, select: { slug: true, type: true, updatedAt: true } });
    for (const e of exprs) {
      const prefix = e.type === 'idiom' ? '/idioms' : '/untranslatable';
      entries.push({ loc: `${SITE_URL}${prefix}/${e.slug}`, lastmod: e.updatedAt });
    }

    const scenes = await prisma.sceneEntry.findMany({ where: { status: 'published' }, select: { kind: true, country: true, slug: true, updatedAt: true } });
    for (const s of scenes) {
      const prefix = s.kind === 'travel' ? '/travel' : '/life';
      entries.push({ loc: `${SITE_URL}${prefix}/${s.country}/${s.slug}`, lastmod: s.updatedAt });
    }

    const menus = await prisma.menuEntry.findMany({ where: { status: 'published' }, select: { country: true, slug: true, updatedAt: true } });
    for (const m of menus) entries.push({ loc: `${SITE_URL}/menu/${m.country}/${m.slug}`, lastmod: m.updatedAt });

    const recipes = await prisma.recipeEntry.findMany({ where: { status: 'published' }, select: { slug: true, updatedAt: true } });
    for (const r of recipes) entries.push({ loc: `${SITE_URL}/recipes/${r.slug}`, lastmod: r.updatedAt });

    // 盲测擂台详情页（Arena，蓝图补缺项 ④）
    const blindtests = await prisma.blindtest.findMany({ where: { status: 'published' }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    for (const b of blindtests) entries.push({ loc: `${SITE_URL}/arena/${b.id}`, lastmod: b.createdAt });

    // meme tag 聚合页（52 个）
    const tagRows = await prisma.$queryRaw`SELECT DISTINCT unnest(tags) AS tag FROM "MemeEntry" WHERE status = 'published'`;
    for (const t of tagRows as { tag: string }[]) {
      entries.push({ loc: `${SITE_URL}/meme/tag/${encodeURIComponent(t.tag)}` });
    }
  } catch {
    // DB 不可用时输出已收集部分（不让 sitemap 500）
  }

  return new Response(buildXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
