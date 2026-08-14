/**
 * Storage 生命周期 cleanup job（服务器 crontab 每日运行）
 * soft-deleted 资产（deletedAt 超过宽限期）→ 删 Storage 文件 → 硬删 DB 记录（cascade translations）
 * 幂等：文件删除失败跳过，下次重试；文件不存在视为已删除
 * 运行：cd /opt/aifanyi && npx tsx scripts/cleanup-storage.ts
 */
import { prisma } from '../src/lib/db';
import { getStorageService } from '../src/lib/storage/storage-service';

const GRACE_DAYS = 7;
const GRACE_MS = GRACE_DAYS * 24 * 3600 * 1000;

async function main() {
  const storage = getStorageService();
  const cutoff = new Date(Date.now() - GRACE_MS);

  const assets = await prisma.ecommerceAsset.findMany({
    where: { status: 'deleted', deletedAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
  });

  let purged = 0;
  let failed = 0;
  for (const a of assets) {
    try {
      await storage.delete(a.storageKey); // 幂等：文件不存在视为已删除
      await prisma.ecommerceAsset.delete({ where: { id: a.id } }); // cascade translations
      purged++;
    } catch (e: any) {
      failed++;
      console.error(`[cleanup-storage] failed ${a.id}:`, e?.message || e);
    }
  }
  console.log(`[cleanup-storage] 完成：purged=${purged} failed=${failed}（宽限期 ${GRACE_DAYS} 天）`);
}

main()
  .catch((e) => {
    console.error('[cleanup-storage] error:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
