// check-in-meaning 单条入库（字段已补齐，走新建通道）
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();
const fix = JSON.parse(fs.readFileSync('/opt/aifanyi/prisma/check-in-fix.json', 'utf8'));
const e = Array.isArray(fix.entries) ? fix.entries[0] : (fix.entries ? fix.entries : fix);

(async () => {
  const exists = await prisma.phraseEntry.findUnique({ where: { slug: e.slug } });
  if (exists) { console.log('ALREADY_EXISTS ' + e.slug); await prisma.$disconnect(); return; }
  // 护栏
  const examples = Array.isArray(e.examples) ? e.examples.filter(x => x && x.en && x.zh) : [];
  if (!e.shortAnswer || examples.length < 1 || !Array.isArray(e.tags) || !e.tags.length) {
    console.log('GUARD_FAIL examples=' + examples.length + ' tags=' + (e.tags || []).length);
    process.exit(1);
  }
  await prisma.phraseEntry.create({
    data: {
      term: e.term,
      pair: e.pair || 'en-zh',
      slug: e.slug,
      lang: 'en',
      translation: e.translation,
      shortAnswer: e.shortAnswer,
      definition: e.definition || null,
      examples,
      tags: e.tags,
      searchIntentType: e.searchIntentType || 'meaning',
      status: 'published',
      popularity: 75,
    },
  });
  const total = await prisma.phraseEntry.count();
  const byPair = await prisma.phraseEntry.groupBy({ by: ['pair'], _count: true });
  console.log('CHECKIN_CREATED total=' + total + ' BYPAIR=' + JSON.stringify(byPair));
  await prisma.$disconnect();
})().catch(err => { console.error('FAIL ' + err.message.slice(0, 200)); process.exit(1); });
