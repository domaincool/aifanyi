// Seed b23: single 彩蛋 zh-en entry (create-only).
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();

const e = JSON.parse(fs.readFileSync('/opt/aifanyi/prisma/v2h-b23-entry.json', 'utf8'));

(async () => {
  const exists = await prisma.phraseEntry.findUnique({ where: { slug: e.slug } });
  if (exists) { console.log('B23_SKIP exists pair=' + exists.pair + ' term=' + exists.term); await prisma.$disconnect(); return; }
  await prisma.phraseEntry.create({
    data: {
      term: e.term, pair: e.pair, slug: e.slug, lang: e.lang,
      translation: e.translation, shortAnswer: e.shortAnswer,
      definition: e.definition || null, examples: e.examples, tags: e.tags,
      searchIntentType: e.searchIntentType, status: 'published', popularity: 70,
    },
  });
  console.log('B23_CREATED ' + e.pair + ' ' + e.slug + ' term=' + e.term);
  const counts = await prisma.phraseEntry.groupBy({ by: ['pair'], _count: { pair: true } });
  counts.forEach((c) => console.log('COUNT ' + c.pair + ' ' + c._count.pair));
  await prisma.$disconnect();
})().catch(err => { console.error('FAIL ' + String(err.message).slice(0, 200)); process.exit(1); });
