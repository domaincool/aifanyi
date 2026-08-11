/**
 * 梗词条种子数据（200 条）
 * 运行：npm run db:seed
 * 数据源：prisma/meme-data.ts（批量 upsert，按 slug 去重）
 */
import { PrismaClient } from '@prisma/client';
import { memeData } from './meme-data';
import { memeBatch001 } from './meme-batch-001';
import { memeBatch002 } from './meme-batch-002';
import { memeBatch003 } from './meme-batch-003';
import { memeBatch004 } from './meme-batch-004';
import { memeBatch005 } from './meme-batch-005';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;
  const allEntries = [...memeData, ...memeBatch001, ...memeBatch002, ...memeBatch003, ...memeBatch004, ...memeBatch005];
  for (const m of allEntries) {
    const existing = await prisma.memeEntry.findUnique({ where: { slug: m.slug } });
    if (existing) {
      await prisma.memeEntry.update({ where: { slug: m.slug }, data: m as any });
      updated++;
    } else {
      await prisma.memeEntry.create({ data: m as any });
      created++;
    }
  }
  const total = await prisma.memeEntry.count();
  console.log(`seed 完成：新建 ${created} 条 / 更新 ${updated} 条 / 当前总数 ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
