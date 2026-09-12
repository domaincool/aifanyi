import fs from 'fs';
// 手动加载 .env（tsx 不自动读）
const env = fs.readFileSync('.env', 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const memeTotal = await prisma.memeEntry.count();
  console.log('memeTotal', memeTotal);
  const all = await prisma.memeEntry.findMany({ where: { status: 'published' }, select: { tags: true, slug: true, term: true, translation: true, popularity: true } });
  const tagCount = new Map<string, number>();
  for (const m of all) for (const t of (m.tags as string[]) || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1]);
  console.log('TAGS:', JSON.stringify(sorted));
  const sceneCount = await prisma.sceneEntry.count({ where: { kind: 'travel' } });
  console.log('sceneTravel', sceneCount);
  const scenes = await prisma.sceneEntry.findMany({ where: { kind: 'travel' }, select: { scene: true, title: true, country: true, phrases: true }, take: 60 });
  console.log('SCENES:', JSON.stringify(scenes.map(s => ({ s: s.scene, t: s.title, c: s.country, ph: (s.phrases as any[])?.length }))));
  const exprCounts = await prisma.expressionEntry.groupBy({ by: ['type'], _count: true });
  console.log('exprTypes', JSON.stringify(exprCounts));
}
main().finally(() => prisma.$disconnect());
