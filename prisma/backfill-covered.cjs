// 一次性回填：存量 ContentOpportunity 的 covered（与 server.ts findExistingCoverage 同逻辑）
const fs = require('fs');
for (const line of fs.readFileSync('/opt/aifanyi/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*?)"?\s*\r?$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
process.env.NODE_ENV = 'production';
const { PrismaClient } = require('/opt/aifanyi/node_modules/.prisma/client/default.js');
const prisma = new PrismaClient();

(async () => {
  const uncovered = await prisma.contentOpportunity.findMany({ where: { covered: false } });
  let marked = 0;
  const log = [];
  for (const o of uncovered) {
    const normalized = o.candidateTerm.trim().toLowerCase();
    if (!normalized) continue;
    const meme = await prisma.memeEntry.findFirst({
      where: { term: { equals: normalized, mode: 'insensitive' }, status: 'published' },
      select: { slug: true },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
    });
    if (meme) {
      await prisma.contentOpportunity.update({ where: { id: o.id }, data: { covered: true, coverageKind: 'meme', coveredBy: meme.slug } });
      marked++;
      log.push(`COVERED ${o.candidateTerm} (${o.intent}) → meme/${meme.slug}`);
      continue;
    }
    const expr = await prisma.expressionEntry.findFirst({
      where: { term: { equals: normalized, mode: 'insensitive' }, status: 'published' },
      select: { slug: true, type: true },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
    });
    if (expr) {
      const kind = expr.type === 'idiom' ? 'idiom' : expr.type === 'untranslatable' ? 'untranslatable' : 'expression';
      await prisma.contentOpportunity.update({ where: { id: o.id }, data: { covered: true, coverageKind: kind, coveredBy: expr.slug } });
      marked++;
      log.push(`COVERED ${o.candidateTerm} (${o.intent}) → ${kind}/${expr.slug}`);
    } else {
      log.push(`KEEP ${o.candidateTerm} (${o.intent}) — 真缺口`);
    }
  }
  const after = await prisma.contentOpportunity.groupBy({ by: ['covered'], _count: true });
  console.log(`BACKFILL_OK processed=${uncovered.length} marked=${marked}`);
  console.log(log.join('\n'));
  console.log('AFTER: ' + JSON.stringify(after));
  await prisma.$disconnect();
})().catch(e => { console.error('FAIL ' + e.message.slice(0, 200)); process.exit(1); });
