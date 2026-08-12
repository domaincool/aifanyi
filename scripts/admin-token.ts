/**
 * 生成 admin(domaincool) 的 session token（阶段 7 E2E 用）
 * 输出 ADMIN_TOKEN:xxx
 */
import { prisma } from '../src/lib/db';
import { createSession } from '../src/lib/auth/session';

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'domaincool@gmail.com' } });
  if (!u) { console.log('NO_USER'); return; }
  const s = await createSession(u.id);
  console.log('ADMIN_TOKEN:' + s.sessionToken);
}

main().catch((e) => { console.error(e); process.exit(1); });
