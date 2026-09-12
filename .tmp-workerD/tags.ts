import { memeData } from '../prisma/meme-data';
import { memeBatch001 } from '../prisma/meme-batch-001';
import { memeBatch002 } from '../prisma/meme-batch-002';
import { memeBatch003 } from '../prisma/meme-batch-003';
import { memeBatch004 } from '../prisma/meme-batch-004';
import { memeBatch005 } from '../prisma/meme-batch-005';

type Seed = { term: string; slug: string; meaning: string; translation: string; examples: { zh: string; en: string }[]; tags: string[]; popularity?: number };
const all: Seed[] = [...(memeData as any[]), ...memeBatch001 as any[], ...memeBatch002 as any[], ...memeBatch003 as any[], ...memeBatch004 as any[], ...memeBatch005 as any[]];
const tagCount = new Map<string, number>();
for (const m of all) for (const t of m.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
console.log('TOTAL', all.length);
console.log('TAGS', JSON.stringify([...tagCount.entries()].sort((a, b) => b[1] - a[1])));
for (const t of ['职场', '社交', '恋爱', '校园', '学术', '商务', '电商', '旅行']) {
  const list = all.filter((m) => (m.tags || []).includes(t));
  console.log('---', t, list.length);
  console.log(list.slice(0, 30).map((m) => m.slug + '|' + m.term + '|' + m.translation.slice(0, 40)).join(' ;; '));
}
