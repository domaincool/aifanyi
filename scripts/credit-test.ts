/**
 * Credit Engine 单测 v2（服务器跑：npx tsx scripts/credit-test.ts）
 * 覆盖：reserve / consume / release / refund / 余额不足 / 幂等 / 并发 / 过期 / grant / 对账
 * 核心断言：任何异常下余额不为负、不凭空增减；Ledger 总和 == available+reserved
 * 测试用户：credit_test@aifanyi.local + credit_concurrent@aifanyi.local（结束自动清理）
 */
import { prisma } from '../src/lib/db';
import {
  reserve, consume, release, refund, grantCredits, expireCredits, getBalance, adminAdjustment,
} from '../src/lib/credit/engine';
import { estimateCredits, charsToUnits, pagesToUnits } from '../src/lib/credit/pricing';
import { FEATURES, GRANT_TYPES } from '../src/lib/credit/types';

let pass = 0, fail = 0;
const results: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; results.push(`✅ ${name}`); }
  else { fail++; results.push(`❌ ${name} ${detail}`); }
}

async function cleanUser(email: string): Promise<string> {
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.creditLedger.deleteMany({ where: { userId: user.id } });
    await prisma.creditGrant.deleteMany({ where: { userId: user.id } });
    await prisma.usageRecord.deleteMany({ where: { userId: user.id } });
    await prisma.creditAccount.deleteMany({ where: { userId: user.id } });
  } else {
    user = await prisma.user.create({ data: { email, nickname: email.split('@')[0], status: 'active' } });
  }
  return user.id;
}

async function main() {
  const uid = await cleanUser('credit_test@aifanyi.local');
  const job = `test_${Date.now().toString(36)}`;
  console.log('测试用户:', uid);

  // ── 1. Grant ──
  let r: any = await grantCredits({ userId: uid, type: GRANT_TYPES.BONUS, source: '注册赠送', amount: 300, idempotencyKey: `grant:${job}:1` });
  check('grant 300', r.ok);
  let bal = await getBalance(uid);
  check('grant 后可用=300', bal.available === 300, `实际 ${bal.available}`);

  // ── 2. 幂等 grant ──
  await grantCredits({ userId: uid, type: GRANT_TYPES.BONUS, source: '注册赠送', amount: 300, idempotencyKey: `grant:${job}:1` });
  bal = await getBalance(uid);
  check('grant 幂等（不重复加）', bal.available === 300, `实际 ${bal.available}`);

  // ── 3. Reserve 100 ──
  r = await reserve({ userId: uid, jobId: job, feature: FEATURES.PDF, estimatedCredits: 100, idempotencyKey: `${job}:reserve` });
  check('reserve 100', r.ok);
  bal = await getBalance(uid);
  check('reserve 后 available=200 reserved=100', bal.available === 200 && bal.reserved === 100, `a=${bal.available} r=${bal.reserved}`);

  // ── 4. Reserve 幂等 ──
  await reserve({ userId: uid, jobId: job, feature: FEATURES.PDF, estimatedCredits: 100, idempotencyKey: `${job}:reserve` });
  bal = await getBalance(uid);
  check('reserve 幂等（不重复扣）', bal.available === 200 && bal.reserved === 100, `a=${bal.available} r=${bal.reserved}`);

  // ── 5. Consume 80 ──
  const usage = await prisma.usageRecord.findFirst({ where: { userId: uid, jobId: job } });
  check('UsageRecord 存在', !!usage);
  if (usage) {
    r = await consume({ userId: uid, jobId: job, usageId: usage.id, actualCredits: 80, idempotencyKey: `${job}:consume` });
    check('consume 80', r.ok);
    bal = await getBalance(uid);
    check('consume 后 available=200 reserved=20', bal.available === 200 && bal.reserved === 20, `a=${bal.available} r=${bal.reserved}`);

    // ── 6. Consume 幂等 ──
    await consume({ userId: uid, jobId: job, usageId: usage.id, actualCredits: 80, idempotencyKey: `${job}:consume` });
    bal = await getBalance(uid);
    check('consume 幂等（不重复扣）', bal.available === 200 && bal.reserved === 20, `a=${bal.available} r=${bal.reserved}`);

    // ── 7. Release 20 ──
    r = await release({ userId: uid, jobId: job, usageId: usage.id, amount: 20, idempotencyKey: `${job}:release` });
    check('release 20', r.ok);
    bal = await getBalance(uid);
    check('release 后 available=220 reserved=0', bal.available === 220 && bal.reserved === 0, `a=${bal.available} r=${bal.reserved}`);

    // ── 8. Release 幂等 ──
    await release({ userId: uid, jobId: job, usageId: usage.id, amount: 20, idempotencyKey: `${job}:release` });
    bal = await getBalance(uid);
    check('release 幂等（不重复加）', bal.available === 220 && bal.reserved === 0, `a=${bal.available} r=${bal.reserved}`);
  }

  // ── 9. Refund 30 ──
  r = await refund({ userId: uid, jobId: job, amount: 30, reason: '系统错误测试', idempotencyKey: `${job}:refund` });
  check('refund 30', r.ok);
  bal = await getBalance(uid);
  check('refund 后 available=250', bal.available === 250, `实际 ${bal.available}`);

  // ── 10. Refund 幂等 ──
  await refund({ userId: uid, jobId: job, amount: 30, reason: '系统错误测试', idempotencyKey: `${job}:refund` });
  bal = await getBalance(uid);
  check('refund 幂等（不重复加）', bal.available === 250, `实际 ${bal.available}`);

  // ── 11. 余额不足 ──
  r = await reserve({ userId: uid, jobId: job + ':b', feature: FEATURES.PDF, estimatedCredits: 300, idempotencyKey: `${job}:b:reserve` });
  check('余额不足 reserve 拒绝', !r.ok && r.error === 'insufficient');
  bal = await getBalance(uid);
  check('拒绝后余额不变 250', bal.available === 250, `实际 ${bal.available}`);

  // ── 12. Admin 扣减 50 ──
  r = await adminAdjustment({ userId: uid, type: GRANT_TYPES.ADMIN_ADJUSTMENT, source: '客服补偿', amount: -50, reason: '测试扣减', idempotencyKey: `adj:${job}:1`, adminId: 'test' });
  check('admin 扣减 50', r.ok);
  bal = await getBalance(uid);
  check('admin 后 available=200', bal.available === 200, `实际 ${bal.available}`);

  // ── 13. Admin 扣减超余额拒绝 ──
  r = await adminAdjustment({ userId: uid, type: GRANT_TYPES.ADMIN_ADJUSTMENT, source: '客服补偿', amount: -99999, reason: '超扣测试', idempotencyKey: `adj:${job}:2`, adminId: 'test' });
  check('admin 超扣拒绝', !r.ok && r.error === 'insufficient');
  bal = await getBalance(uid);
  check('超扣拒绝后余额不变 200', bal.available === 200, `实际 ${bal.available}`);

  // ── 14. 过期 ──
  await grantCredits({ userId: uid, type: GRANT_TYPES.BONUS, source: '过期测试', amount: 60, expiresAt: new Date(Date.now() - 1000), idempotencyKey: `grant:${job}:2` });
  const before = await getBalance(uid);
  const exp = await expireCredits();
  check('expire 处理了过期 grant', exp.expired >= 1);
  bal = await getBalance(uid);
  check('过期后余额减 60', bal.available === before.available - 60, `before=${before.available} after=${bal.available}`);
  const expiredLedger = await prisma.creditLedger.count({ where: { userId: uid, type: 'expire' } });
  check('过期写 Ledger(expire)', expiredLedger >= 1);

  // ── 15. Pricing ──
  const est = await estimateCredits(FEATURES.PDF, pagesToUnits(10));
  check('PDF 10 页预估 20', est?.credits === 20, `实际 ${est?.credits}`);
  const estText = await estimateCredits(FEATURES.TEXT, charsToUnits(5000));
  check('文本 5000 字符预估 10', estText?.credits === 10, `实际 ${estText?.credits}`);
  const estPdf100 = await estimateCredits(FEATURES.PDF, pagesToUnits(150));
  check('PDF 150 页封顶 200', estPdf100?.credits === 200, `实际 ${estPdf100?.credits}`);

  // ── 16. 对账：Ledger 总和 == available + reserved ──
  const ledgerSum = await prisma.creditLedger.aggregate({ where: { userId: uid }, _sum: { amount: true } });
  bal = await getBalance(uid);
  check('Ledger 总和 == 余额总额', (ledgerSum._sum.amount || 0) === bal.available + bal.reserved, `ledger=${ledgerSum._sum.amount} total=${bal.available + bal.reserved}`);

  // ═══════ 并发测试（独立用户，余额精确 90）═══════
  const cu = await cleanUser('credit_concurrent@aifanyi.local');
  console.log('\n并发测试用户:', cu);
  await grantCredits({ userId: cu, type: GRANT_TYPES.BONUS, source: '并发测试', amount: 90, idempotencyKey: `grant:con:0` });
  const cj = `con_${Date.now().toString(36)}`;
  const results10 = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      reserve({ userId: cu, jobId: `${cj}:${i}`, feature: FEATURES.TEXT, estimatedCredits: 30, idempotencyKey: `${cj}:${i}:reserve` })
    )
  );
  const okCount = results10.filter((x) => x.ok).length;
  check('并发 10×30/余额90 恰 3 成功', okCount === 3, `实际 ${okCount} 成功`);
  bal = await getBalance(cu);
  check('并发后 available=0 reserved=90', bal.available === 0 && bal.reserved === 90, `a=${bal.available} r=${bal.reserved}`);
  check('余额绝不为负', bal.available >= 0 && bal.reserved >= 0);

  // 释放并发预留 → 恢复 90
  for (let i = 0; i < 10; i++) {
    const u = await prisma.usageRecord.findFirst({ where: { userId: cu, jobId: `${cj}:${i}` } });
    if (u) await release({ userId: cu, jobId: `${cj}:${i}`, usageId: u.id, amount: 30, idempotencyKey: `${cj}:${i}:release` });
  }
  bal = await getBalance(cu);
  check('并发释放后 available=90 reserved=0', bal.available === 90 && bal.reserved === 0, `a=${bal.available} r=${bal.reserved}`);
  const conLedger = await prisma.creditLedger.aggregate({ where: { userId: cu }, _sum: { amount: true } });
  check('并发用户 Ledger 对账', (conLedger._sum.amount || 0) === 90, `ledger=${conLedger._sum.amount}`);

  // ── 清理 ──
  for (const email of ['credit_test@aifanyi.local', 'credit_concurrent@aifanyi.local']) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.creditLedger.deleteMany({ where: { userId: u.id } });
      await prisma.creditGrant.deleteMany({ where: { userId: u.id } });
      await prisma.usageRecord.deleteMany({ where: { userId: u.id } });
      await prisma.creditAccount.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  console.log('\n===== 测试结果 =====');
  console.log(results.join('\n'));
  console.log(`\n通过 ${pass} / 失败 ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1); });
