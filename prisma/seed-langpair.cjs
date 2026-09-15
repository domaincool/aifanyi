// langpair-batch1 入库：70 词条 → PhraseEntry（幂等 upsert by slug；护栏校验不达标跳过）
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();

const batch = JSON.parse(fs.readFileSync('/opt/aifanyi/prisma/langpair-batch1.json', 'utf8'));
const arr = batch.entries || batch.words;

(async () => {
  let created = 0, updated = 0, skipped = 0;
  const log = [];
  for (const e of arr) {
    // 护栏：核心字段 + 例句 + tags
    if (!e.term || !e.pair || !e.slug || !e.translation || !e.shortAnswer || !e.searchIntentType) {
      skipped++; log.push(`SKIP ${e.term || '?'}: 核心字段缺失`); continue;
    }
    const examples = Array.isArray(e.examples) ? e.examples.filter(x => x && x.en && x.zh) : [];
    if (examples.length < 1) { skipped++; log.push(`SKIP ${e.term}: 例句不足`); continue; }
    const tags = Array.isArray(e.tags) && e.tags.length ? e.tags : null;
    if (!tags) { skipped++; log.push(`SKIP ${e.term}: tags 缺失`); continue; }

    const data = {
      term: e.term,
      pair: e.pair,
      slug: e.slug,
      lang: e.pair === 'zh-en' ? 'zh' : 'en',
      translation: e.translation,
      shortAnswer: e.shortAnswer,
      definition: e.definition || null,
      examples,
      tags,
      searchIntentType: e.searchIntentType,
      status: 'published',
      popularity: e.popularity || 70,
    };
    const exists = await prisma.phraseEntry.findUnique({ where: { slug: e.slug } });
    if (exists) {
      await prisma.phraseEntry.update({ where: { slug: e.slug }, data });
      updated++;
    } else {
      await prisma.phraseEntry.create({ data });
      created++;
    }
  }
  console.log(`PHRASE_SEED_OK created=${created} updated=${updated} skipped=${skipped}`);
  log.filter(l => l.startsWith('SKIP')).forEach(l => console.log(l));
  await prisma.$disconnect();
})().catch(e => { console.error('FAIL ' + e.message.slice(0, 200)); process.exit(1); });
