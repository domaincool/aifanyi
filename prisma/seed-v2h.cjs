// Seed v2-C bidirectional entries (240) into PhraseEntry on the server.
// create-only: existing slugs are skipped (protects earlier batches).
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();

const batch = JSON.parse(fs.readFileSync('/opt/aifanyi/prisma/langpair-v2H-full.json', 'utf8'));
const arr = batch.entries || [];

(async () => {
  let created = 0, skipped = 0;
  const byPair = {};
  const log = [];
  for (const e of arr) {
    if (!e.term || !e.pair || !e.slug || !e.translation || !e.shortAnswer || !e.searchIntentType) {
      skipped++; log.push('SKIP ' + (e.slug || '?') + ': core fields missing'); continue;
    }
    const examples = Array.isArray(e.examples) ? e.examples.filter(x => x && x.en && x.zh) : [];
    if (examples.length < 1) { skipped++; log.push('SKIP ' + e.slug + ': examples insufficient'); continue; }
    const tags = Array.isArray(e.tags) && e.tags.length ? e.tags : null;
    if (!tags) { skipped++; log.push('SKIP ' + e.slug + ': tags missing'); continue; }
    const exists = await prisma.phraseEntry.findUnique({ where: { slug: e.slug } });
    if (exists) { skipped++; log.push('SKIP ' + e.slug + ': exists pair=' + exists.pair + ' term=' + exists.term); continue; }
    try {
      await prisma.phraseEntry.create({
        data: {
          term: e.term, pair: e.pair, slug: e.slug, lang: e.lang || (e.pair === 'zh-en' ? 'zh' : 'en'),
          translation: e.translation, shortAnswer: e.shortAnswer,
          definition: e.definition || null, examples, tags,
          searchIntentType: e.searchIntentType, status: 'published', popularity: 70,
        },
      });
      created++; byPair[e.pair] = (byPair[e.pair] || 0) + 1;
    } catch (err) { skipped++; log.push('SKIP ' + e.slug + ': ' + String(err.message).slice(0, 80)); }
  }
  console.log('V2C_SEED_OK created=' + created + ' skipped=' + skipped + ' byPair=' + JSON.stringify(byPair));
  log.forEach(l => console.log(l));
  await prisma.$disconnect();
})().catch(e => { console.error('FAIL ' + String(e.message).slice(0, 200)); process.exit(1); });
