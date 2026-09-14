// 缺口词条入库（3 条新建；用与 seed-deep 相同的转换逻辑 + 全字段创建）
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();
const batch = JSON.parse(fs.readFileSync('/opt/aifanyi/prisma/gap-entries.json', 'utf8'));

function toneToEnum(text) {
  const t = text || '';
  const posIdx = Math.min(...['褒义', '真心夸', '称赞', '正面'].map(k => { const i = t.indexOf(k); return i === -1 ? 1e9 : i; }));
  const negIdx = Math.min(...['贬义', '嫌弃', '反感', '下头'].map(k => { const i = t.indexOf(k); return i === -1 ? 1e9 : i; }));
  const vals = [];
  if (posIdx < 1e9 || negIdx < 1e9) vals.push(negIdx < posIdx ? 'negative' : 'positive');
  if (/调侃|玩梗|玩笑|互损|打趣/.test(t)) vals.push('playful');
  if (/口语|日常/.test(t)) vals.push('casual');
  if (/讽刺|挖苦|自嘲/.test(t)) vals.push('sarcastic');
  if (!vals.length) vals.push('neutral');
  return [...new Set(vals)].slice(0, 3).join(',');
}
function parseCollocation(s) {
  const m = s.match(/^(.*?)（([^）]*)）\s*$/);
  if (m && m[1].trim()) return { phrase: m[1].trim(), zh: m[2].trim() };
  return { phrase: s.trim() };
}
function parseMis(text, term) {
  const wrongs = [];
  for (const re2 of [/直译[成把为]「([^」]+)」/g, /[翻译成把为]「([^」]+)」/g, /译成「([^」]+)」/g]) {
    let m2;
    while ((m2 = re2.exec(text)) !== null) wrongs.push(m2[1].trim());
  }
  let right = '按语境意译';
  for (const re3 of [/[翻译理解]?[成作]为?「([^」]+)」(最准|最贴切|即可|就好)/, /(翻成|译成|理解成|说成)「([^」]+)」最/]) {
    const m3 = text.match(re3);
    if (m3) { right = m3[2] || m3[1]; break; }
  }
  const uniq = [...new Set(wrongs)].filter(w => w && w !== term && w !== right).slice(0, 2);
  if (!uniq.length) return [{ wrong: '逐字直译', right, why: text.slice(0, 200) }];
  return uniq.map(w => ({ wrong: w, right, why: text.slice(0, 200) }));
}

(async () => {
  let created = 0;
  for (const e of batch.entries) {
    const exists = await prisma.memeEntry.findUnique({ where: { term: e.term } });
    if (exists) { console.log('SKIP ' + e.term); continue; }
    const examples = (e.examples || []).map(s => {
      const m = s.match(/^(.*?)（([^）]*)）\s*$/);
      if (m) return { en: m[1].trim(), zh: m[2].trim() };
      return { en: s.trim(), zh: '' };
    });
    await prisma.memeEntry.create({
      data: {
        term: e.term,
        slug: e.slug,
        lang: 'en',
        meaning: e.meaning || '',
        translation: e.translation || e.term,
        examples,
        tags: e.tags || ['英语表达'],
        popularity: e.popularity || 85,
        status: 'published',
        shortAnswer: (e.meaning || '').slice(0, 100),
        definition: e.hiddenMeaning || null,
        usage: e.hiddenMeaning ? e.hiddenMeaning.slice(0, 150) : null,
        searchIntentType: e.term === '你别太自恋' ? 'how_to_say' : 'meaning',
        tone: toneToEnum(e.tone),
        collocations: (e.collocations || []).map(parseCollocation).filter(c => c.phrase),
        misTranslated: parseMis(e.misTranslated || '', e.term),
      },
    });
    created++;
    console.log(`CREATE ${e.term} (${e.slug})`);
  }
  console.log('GAP_SEED_OK created=' + created);
  await prisma.$disconnect();
})().catch(e => { console.error('FAIL ' + e.message.slice(0, 200)); process.exit(1); });
