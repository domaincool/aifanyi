// en-zh 反向展开：从 250 条 zh-en 生成 en-zh 词条（term=英文首选词，shortAnswer 镜像模板，例句复用）
// 在服务器跑；护栏：生成后每条字段校验，不达标跳过
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();

(async () => {
  const zhEn = await prisma.phraseEntry.findMany({ where: { pair: 'zh-en', status: 'published' } });
  let created = 0, skipped = 0;
  const log = [];
  for (const e of zhEn) {
    // 英文主词：translation 首选（/ 或逗号分隔取第一段），剥离变体
    const primary = (e.translation || '').split(/[/,，、]/)[0].trim();
    if (!primary || primary.length < 1 || primary.length > 40) { skipped++; log.push(`SKIP ${e.slug}: 主词异常「${primary}」`); continue; }
    const slug = primary.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    if (!slug || slug.length < 2) { skipped++; log.push(`SKIP ${e.slug}: slug 异常「${slug}」`); continue; }

    const exists = await prisma.phraseEntry.findUnique({ where: { slug } });
    if (exists) { skipped++; log.push(`SKIP ${slug}: slug 已存在（${exists.pair}）`); continue; }

    // 反向词条
    const shortAnswer = `「${primary}」的中文意思是「${e.term}」。${e.translation.includes('/') || e.translation.includes('，') ? '具体译法需看语境，常见用法见例句。' : ''}`.slice(0, 100);
    const data = {
      term: primary,
      pair: 'en-zh',
      slug,
      lang: 'en',
      translation: e.term,
      shortAnswer,
      definition: e.definition || null,
      examples: e.examples,
      tags: e.tags,
      searchIntentType: 'meaning',
      status: 'published',
      popularity: e.popularity,
    };
    await prisma.phraseEntry.create({ data });
    created++;
    if (created <= 5 || created % 50 === 0) log.push(`CREATE ${primary} (${slug}) ← ${e.term}`);
  }
  console.log(`ENZH_SEED_OK created=${created} skipped=${skipped}`);
  log.forEach(l => console.log(l));
  await prisma.$disconnect();
})().catch(e => { console.error('FAIL ' + e.message.slice(0, 200)); process.exit(1); });
