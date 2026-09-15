// en-zh 修正清单 R1 入库：13 update + 1 create（check-in-meaning），按 slug 精准替换
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();

const fixes = JSON.parse(fs.readFileSync('/opt/aifanyi/prisma/langpair-fixes-r1.json', 'utf8')).entries || [];

(async () => {
  let updated = 0, created = 0, skipped = 0;
  const log = [];
  for (const e of fixes) {
    if (!e.slug || !e.pair || !e.term || !e.shortAnswer) { skipped++; log.push(`SKIP ${e.slug || '?'}: 核心字段缺失`); continue; }
    const data = {
      term: e.term,
      pair: e.pair || 'en-zh',
      translation: e.translation || '',
      shortAnswer: e.shortAnswer,
      definition: e.definition || null,
      ...(Array.isArray(e.examples) && e.examples.length ? { examples: e.examples } : {}),
      ...(Array.isArray(e.tags) && e.tags.length ? { tags: e.tags } : {}),
      ...(e.searchIntentType ? { searchIntentType: e.searchIntentType } : {}),
      status: 'published',
    };
    const exists = await prisma.phraseEntry.findUnique({ where: { slug: e.slug } });
    if (exists) {
      // 修正原则：只换 shortAnswer/definition（例句/tags 保留，除非清单显式给了）
      await prisma.phraseEntry.update({
        where: { slug: e.slug },
        data: {
          shortAnswer: data.shortAnswer,
          definition: data.definition,
          ...(Array.isArray(e.examples) && e.examples.length ? { examples: e.examples } : {}),
        },
      });
      updated++;
      log.push(`UPDATE ${e.slug} (sa=${e.shortAnswer.length}字)`);
    } else {
      if (!Array.isArray(e.examples) || !e.examples.length || !Array.isArray(e.tags) || !e.tags.length) {
        skipped++; log.push(`SKIP ${e.slug}: 新建但例句/tags 缺失（护栏）`); continue;
      }
      await prisma.phraseEntry.create({
        data: { ...data, lang: 'en', status: 'published', popularity: 75 },
      });
      created++;
      log.push(`CREATE ${e.slug} (${e.term})`);
    }
  }
  console.log(`FIXES_R1_OK updated=${updated} created=${created} skipped=${skipped}`);
  log.forEach(l => console.log(l));
  const total = await prisma.phraseEntry.count();
  const byPair = await prisma.phraseEntry.groupBy({ by: ['pair'], _count: true });
  console.log('TOTAL=' + total + ' BYPAIR=' + JSON.stringify(byPair));
  await prisma.$disconnect();
})().catch(e => { console.error('FAIL ' + e.message.slice(0, 200)); process.exit(1); });
