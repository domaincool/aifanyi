// 服务器端 seed 脚本：meaning-batch-001.json → MemeEntry（在服务器上跑，用服务器 .env）
const fs = require('fs');
// 手动解析 .env（服务器无 dotenv 顶层依赖）
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();

const batch = JSON.parse(fs.readFileSync('/opt/aifanyi/prisma/meaning-batch-001.json', 'utf8'));

function toneToEnum(text) {
  const t = text || '';
  // 褒贬冲突时取关键词首次出现早者；最终排序 [polarity, playful, casual, sarcastic, formal] 取前 3
  const posIdx = Math.min(...['褒义', '真心夸', '称赞'].map(k => { const i = t.indexOf(k); return i === -1 ? 1e9 : i; }));
  const negIdx = Math.min(...['贬义', '嫌弃', '反感', '下头'].map(k => { const i = t.indexOf(k); return i === -1 ? 1e9 : i; }));
  const vals = [];
  if (posIdx < 1e9 || negIdx < 1e9) vals.push(negIdx < posIdx ? 'negative' : 'positive');
  if (/调侃|玩梗|玩笑|互损|打趣/.test(t)) vals.push('playful');
  if (/口语|日常/.test(t)) vals.push('casual');
  if (/讽刺|挖苦|阴阳/.test(t)) vals.push('sarcastic');
  if (/[／/]\s*正式|也可(以)?用于正式|适合正式场合(?!.{0,6}(不用|别|避免))/.test(t) && !/别用|不能用|避免|不适合正式|正式场合.*别|工作邮件.*怪|显得.*跳脱/.test(t)) vals.push('formal');
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
  // 提取文中给的正确译法（“翻成X最准/最贴切/译成X即可/理解成X”）
  let right = '按语境意译';
  for (const re3 of [/[翻译理解]?[成作]为?「([^」]+)」(最准|最贴切|即可|就好)/, /(翻成|译成|理解成|说成)「([^」]+)」最/, /「([^」]+)」最准/]) {
    const m3 = text.match(re3);
    if (m3) { right = m3[2] || m3[1]; break; }
  }
  const uniq = [...new Set(wrongs)].filter(w => w && w !== term && w !== right).slice(0, 2);
  if (!uniq.length) return [{ wrong: '逐字直译', right, why: text.slice(0, 200) }];
  return uniq.map(w => ({ wrong: w, right, why: text.slice(0, 200) }));
}

(async () => {
  let updated = 0, created = 0;
  const log = [];
  for (const e of batch.entries) {
    const existing = await prisma.memeEntry.findUnique({ where: { term: e.term } });
    const toneEnum = toneToEnum(e.tone);
    const collo = (e.collocations || []).map(parseCollocation).filter(c => c.phrase);
    const mis = parseMis(e.misTranslated || '', e.term);
    if (existing) {
      await prisma.memeEntry.update({ where: { term: e.term }, data: { tone: toneEnum, collocations: collo, misTranslated: mis } });
      updated++;
      log.push(`UPDATE ${e.term} (${e.slug}) tone=${toneEnum} collo=${collo.length} mis=${mis.length}`);
    } else {
      const examples = (e.examples || []).map(s => {
        const m3 = s.match(/^(.*?)（([^）]*)）\s*$/);
        if (m3) return { en: m3[1].trim(), zh: m3[2].trim() };
        return { en: s.trim(), zh: '' };
      });
      await prisma.memeEntry.create({
        data: {
          term: e.term, slug: e.slug, lang: 'en',
          meaning: e.meaning || '',
          translation: (e.meaning || '').split(/[，,；;]/)[0].slice(0, 40) || e.term,
          examples, tags: e.tags || ['网络俚语'], popularity: e.popularity || 80,
          status: 'published',
          shortAnswer: (e.meaning || '').slice(0, 100),
          definition: e.hiddenMeaning || null,
          usage: e.hiddenMeaning ? e.hiddenMeaning.slice(0, 150) : null,
          searchIntentType: 'meaning',
          tone: toneEnum, collocations: collo, misTranslated: mis,
        },
      });
      created++;
      log.push(`CREATE ${e.term} (${e.slug}) pop=${e.popularity}`);
    }
  }
  console.log(`SEED_OK created=${created} updated=${updated}`);
  console.log(log.join('\n'));
  await prisma.$disconnect();
})().catch(e => { console.error('SEED_FAIL', e.message.slice(0, 200)); process.exit(1); });
