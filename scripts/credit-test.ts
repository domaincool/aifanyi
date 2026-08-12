/**
 * Credit Engine 单测（服务器跑：npx tsx scripts/credit-test.ts）
 * 覆盖：reserve / consume / release / refund / 余额不足 / 幂等 / 并发 / 过期 / grant
 * 核心断言：任何异常下余额不为负、不凭空增减
 * 测试用户：credit_test@aifanyi.local（结束自动清理）
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

async function main() {
  // 造测试用户（清理历史残留）
  let user = await prisma.user.findUnique({ where: { email: 'credit_test@aifanyi.local' } });
  if (user) {
    await prisma.creditLedger.deleteMany({ where: { userId: user.id } });
    await prisma.creditGrant.deleteMany({ where: { userId: user.id } });
    await prisma.usageRecord.deleteMany({ where: { userId: user.id } });
    await prisma.creditAccount.deleteMany({ where: { userId: user.id } });
  } else {
    user = await prisma.user.create({
      data: { email: 'credit_test@aifanyi.local', nickname: 'credit_test', status: 'active' },
    });
  }
  const uid = user.id;
  const job = `test_${Date.now().toString(36)}`;
  console.log('测试用户:', uid);

  // ── 1. Grant ──
  let r: any = await grantCredits({ userId: uid, type: GRANT_TYPES.BONUS, source: '注册赠送', amount: 300, idempotencyKey: `grant:${job}:1` });
  check('grant 300', r.ok);
  let bal = await getBalance(uid);
  check('grant 后可用=300', bal.available === 300, `实际 ${bal.available}`);

  // ── 2. 幂等 grant ──
  r = await grantCredits({ userId: uid, type: GRANT_TYPES.BONUS, source: '注册赠送', amount: 300, idempotencyKey: `grant:${job}:1` });
  bal = await getBalance(uid);
  check('grant 幂等（不重复加）', bal.available === 300, `实际 ${bal.available}`);

  // ── 3. Reserve 100 ──
  r = await reserve({ userId: uid, jobId: job, feature: FEATURES.PDF, estimatedCredits: 100, idempotencyKey: `${job}:reserve` });
  check('reserve 100', r.ok);
  bal = await getBalance(uid);
  check('reserve 后 available=200 reserved=100', bal.available === 200 && bal.reserved === 100, `a=${bal.available} r=${bal.reserved}`);

  // ── 4. Reserve 幂等（同 key 重复）──
  r = await reserve({ userId: uid, jobId: job, feature: FEATURES.PDF, estimatedCredits: 100, idempotencyKey: `${job}:reserve` });
  bal = await getBalance(uid);
  check('reserve 幂等（不重复扣）', bal.available === 200 && bal.reserved === 100, `a=${bal.available} r=${bal.reserved}`);

  // ── 5. Consume 80（实际消耗 < 预留）──
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

    // ── 7. Release 剩余 20 ──
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

  // ── 11. 余额不足：reserve 300（可用 250）──
  r = await reserve({ userId: uid, jobId: job + ':b', feature: FEATURES.PDF, estimatedCredits: 300, idempotencyKey: `${job}:b:reserve` });
  check('余额不足 reserve 拒绝', !r.ok && (r as any).error === 'insufficient');
  bal = await getBalance(uid);
  check('拒绝后余额不变 250', bal.available === 250, `实际 ${bal.available}`);

  // ── 12. 并发：grant 100 → 10 并发 reserve 30（应恰 3 成功）──
  const cj = `con_${Date.now().toString(36)}`;
  await grantCredits({ userId: uid, type: GRANT_TYPES.BONUS, source: '并发测试', amount: 100, idempotencyKey: `grant:${cj}:0` });
  const results10 = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      reserve({ userId: uid, jobId: `${cj}:${i}`, feature: FEATURES.TEXT, estimatedCredits: 30, idempotencyKey: `${cj}:${i}:reserve` })
    )
  );
  const okCount = results10.filter((x) => x.ok).length;
  check('并发 10×30/100 恰 3 成功', okCount === 3, `实际 ${okCount} 成功`);
  bal = await getBalance(uid);
  check('并发后余额 ≥0 且 reserved=90', bal.reserved === 90 && bal.available >= 0, `a=${bal.available} r=${bal.reserved}`);
  // 清理并发预留（release 全部，恢复干净状态）
  for (let i = 0; i < 10; i++) {
    const u = await prisma.usageRecord.findFirst({ where: { userId: uid, jobId: `${cj}:${i}` } });
    if (u) await release({ userId: uid, jobId: `${cj}:${i}`, usageId: u.id, amount: 30, idempotencyKey: `${cj}:${i}:release` });
  }

  // ── 13. Admin 扣减 ──
  r = await adminAdjustment({ userId: uid, type: GRANT_TYPES.ADMIN_ADJUSTMENT, source: '客服补偿', amount: -50, reason: '测试扣减', idempotencyKey: `adj:${cj}:1`, adminId: 'test' });
  check('admin 扣减 50', r.ok);
  bal = await getBalance(uid);
  check('admin 扣减后余额 = 250-90+100-50 = 210', bal.available === 210, `实际 ${bal.available}`);

  // ── 14. 过期：造一个过期 grant 60，expire 后清零 ──
  await grantCredits({ userId: uid, type: GRANT_TYPES.BONUS, source: '过期测试', amount: 60, expiresAt: new Date(Date.now() - 1000), idempotencyKey: `grant:${cj}:2` });
  const before = await getBalance(uid);
  const exp = await expireCredits();
  check('expire 处理了过期 grant', exp.expired >= 1);
  bal = await getBalance(uid);
  check('过期后余额减 60', bal.available === before.available - 60, `before=${before.available} after=${bal.available}`);
  const expiredLedger = await prisma.creditLedger.count({ where: { userId: uid, type: 'expire' } });
  check('过期写 Ledger(expire)', expiredLedger >= 1);

  // ── 15. Pricing estimate ──
  const est = await estimateCredits(FEATURES.PDF, pagesToUnits(10));
  check('PDF 10 页预估 20', est?.credits === 20, `实际 ${est?.credits}`);
  const estText = await estimateCredits(FEATURES.TEXT, charsToUnits(5000));
  check('文本 5000 字符预估 10', estText?.credits === 10, `实际 ${estText?.credits}`);
  const estPdf100 = await estimateCredits(FEATURES.PDF, pagesToUnits(150));
  check('PDF 150 页封顶 200', estPdf100?.credits === 200, `实际 ${estPdf100?.credits}`);

  // ── 16. 对账：余额 vs Ledger 总和 ──
  const ledgerSum = await prisma.creditLedger.aggregate({ where: { userId: uid }, _sum: { amount: true } });
  bal = await getBalance(uid);
  check('Ledger 总和 == 当前余额', (ledgerSum._sum.amount || 0) === bal.available, `ledger=${ledgerSum._sum.amount} bal=${bal.available}`);

  // ── 清理测试数据 ──
  await prisma.creditLedger.deleteMany({ where: { userId: uid } });
  await prisma.creditGrant.deleteMany({ where: { userId: uid } });
  await prisma.usageRecord.deleteMany({ where: { userId: uid } });
  await prisma.creditAccount.deleteMany({ where: { userId: uid } });
  await prisma.user.delete({ where: { id: uid } });

  console.log('\n===== 测试结果 =====');
  console.log(results.join('\n'));
  console.log(`\n通过 ${pass} / 失败 ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1); });
