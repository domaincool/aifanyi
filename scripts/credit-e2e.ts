/**
 * 阶段 3 E2E 辅助：造测试用户 + grant 300 + 生成 session token
 * 输出：UID:xxx / TOKEN:xxx 两行，供 bash 脚本提取
 */
import { prisma } from '../src/lib/db';
import { createSession } from '../src/lib/auth/session';
import { grantCredits } from '../src/lib/credit/engine';
import { GRANT_TYPES } from '../src/lib/credit/types';

async function main() {
  const email = 'credit_e2e@aifanyi.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.creditLedger.deleteMany({ where: { userId: user.id } });
    await prisma.creditGrant.deleteMany({ where: { userId: user.id } });
    await prisma.usageRecord.deleteMany({ where: { userId: user.id } });
    await prisma.creditAccount.deleteMany({ where: { userId: user.id } });
  } else {
    user = await prisma.user.create({ data: { email, nickname: 'credit_e2e', status: 'active' } });
  }
  await grantCredits({ userId: user.id, type: GRANT_TYPES.BONUS, source: 'E2E 测试', amount: 300, idempotencyKey: `e2e_grant_${Date.now()}` });
  const { sessionToken } = await createSession(user.id);
  console.log('UID:' + user.id);
  console.log('TOKEN:' + sessionToken);
}

main().catch((e) => { console.error(e); process.exit(1); });
