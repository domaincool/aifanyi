// Phase 1: 登录逻辑切到 AuthIdentity + 数据回填脚本（服务器跑）
// 用法：cd /opt/aifanyi && npx tsx prisma/backfill-authidentity.ts（或 node 编译后跑）
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1) 为所有有 email 的 User 建立 email AuthIdentity
  const users = await prisma.user.findMany({ where: { email: { not: null } } });
  let created = 0, skipped = 0;
  for (const u of users) {
    const email = u.email!;
    const existing = await prisma.authIdentity.findUnique({
      where: { provider_providerAccountId: { provider: 'email', providerAccountId: email } },
    });
    if (!existing) {
      await prisma.authIdentity.create({
        data: { userId: u.id, provider: 'email', providerAccountId: email, providerEmail: email },
      });
      created++;
    } else skipped++;
  }
  console.log(`回填完成：新建 email identity ${created} 条 / 跳过 ${skipped} 条`);
  console.log(`AuthIdentity 总数: ${await prisma.authIdentity.count()}`);
  console.log(`User 总数: ${await prisma.user.count()}`);
}

main().finally(() => prisma.$disconnect());
