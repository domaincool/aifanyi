// 查重：batch-005 20 条 vs 线上库
// term 精确 + slug 精确 + 无连字符变体 + 子串模糊
// 运行：cd G:\autoclaw\aifanyi && node scripts/dedup-check-005.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const entries = require('./meme-batch-005-data.json');

(async () => {
  const existing = await prisma.memeEntry.findMany({ select: { term: true, slug: true } });
  console.log('线上词条总数:', existing.length);
  const terms = new Set(existing.map(e => e.term));
  const slugs = new Set(existing.map(e => e.slug));
  const slugNoDash = new Set(existing.map(e => e.slug.replace(/-/g, '')));
  const dupes = [];

  for (const e of entries) {
    const noDash = e.slug.replace(/-/g, '');
    let reason = null;
    if (terms.has(e.term)) reason = `term 重复: ${e.term}`;
    else if (slugs.has(e.slug)) reason = `slug 重复: ${e.slug}`;
    else if (slugNoDash.has(noDash)) reason = `无连字符变体重复: ${noDash}`;
    else {
      for (const s of slugs) {
        if (e.slug.length >= 5 && (s.includes(e.slug) || e.slug.includes(s))) {
          reason = `子串疑似冲突: ${e.slug} ~ ${s}`;
          break;
        }
      }
    }
    if (reason) dupes.push({ term: e.term, slug: e.slug, reason });
  }

  if (dupes.length) {
    console.log('❌ 查重发现冲突:');
    dupes.forEach(d => console.log(`  - ${d.term} (${d.slug}): ${d.reason}`));
    process.exit(1);
  } else {
    console.log(`✅ 查重通过：${entries.length} 条全部无冲突（term/slug/无连字符变体/子串 四重闸门）`);
  }
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
