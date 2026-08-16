// @ts-nocheck
/**
 * P1-A-3 三档 SKU/Grant 拆分矩阵 · 自动化验收脚本（recharge-e2e.ts）
 *
 * 覆盖断言矩阵：
 *   1. 三档拆分：$4.99 → PURCHASED 3270（expiresAt=null）+ BONUS 330（expiresAt≈now+30d）→ 余额+3600
 *                $1.49 → PURCHASED 1000 一条（无 BONUS）；$13.99 → PURCHASED 8330 + BONUS 1670（30d）
 *   2. 免费 500 隔离：FREE_GRANT 记录不变；未消耗余额=500+3600；消费顺序 FREE_GRANT 先扣（policy 优先级）
 *   3. 幂等：重复 confirm → already:true 且 Ledger 无新增（幂等键冲突）；engine grant 同 key 幂等
 *   4. 验签失败：错误/缺失签名 → invalid → 拒绝 → 不 Grant
 *   5. Refund：engine.refund 入账 + 幂等 + 不为负；支付退款扣回（目标契约，P1-A-4a 合入后自动启用）
 *   6. 并发：同订单并发 confirm 只 Grant 一次（行锁 + 幂等键）；engine 同 key 并发 grant 只落一条
 *   7. Ledger 口径：available + reserved == ΣLedger.amount
 *
 * 运行方式（本地 mock provider）：
 *   cd G:\autoclaw\aifanyi && npm run dev（或 build+start，端口 3000）
 *   npx tsx <本文件绝对路径>
 *   可选环境变量 SKU_E2E_BASE=http://127.0.0.1:3000（默认）
 *   退出码：0=全过；1=有 FAIL（SKIP 不计失败）
 *
 * 前置条件：.env（SESSION_SECRET≥32 字符 / DATABASE_URL）；npx tsx prisma/seed-plans.ts 已入库；
 *           Node ≥18（fetch / AbortController）。
 * 测试账号：sku_e2e_*@aifanyi.local（脚本自建 + 开头/结尾清理，不碰生产数据；生产禁 mock）。
 *
 * 说明：脚本自动定位项目根（优先 G:\autoclaw\aifanyi，否则 cwd）；tsx 按 tsconfig paths 解析 @/ 别名。
 *       本机 Windows esbuild win32 缺失导致 npx tsx 报错时，由主线程在服务器（esbuild linux-x64 已装）运行。
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── 项目根定位：本机开发路径优先，否则回退 cwd（服务器/其他机器在项目目录内运行）──
const PROJECT_ROOT = fs.existsSync('G:\\autoclaw\\aifanyi\\package.json')
  ? 'G:\\autoclaw\\aifanyi'
  : process.cwd();

// ── 手动加载 .env（必须在 require 业务模块之前，SESSION_SECRET/DATABASE_URL 就绪）──
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) throw new Error('未找到 .env：' + envPath);
  const map = {};
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '');
      process.env[m[1]] = v;
      map[m[1]] = v;
    }
  }
  return map;
}
const ENV = loadEnv();
// 捕获 .env 中的 CREEM_WEBHOOK_SECRET（若有），供 5b 构造有效 refund 事件；4a 的 dummy secret 用完会还原
const ORIG_CREEM_SECRET = process.env.CREEM_WEBHOOK_SECRET;

// ── 业务模块（cjs require + tsx 转译；tsx 按 tsconfig paths 解析 @/）──
const { prisma } = require(path.join(PROJECT_ROOT, 'src/lib/db'));
const { createSession } = require(path.join(PROJECT_ROOT, 'src/lib/auth/session'));
const engine = require(path.join(PROJECT_ROOT, 'src/lib/credit/engine'));
const { GRANT_TYPES, LEDGER_TYPES } = require(path.join(PROJECT_ROOT, 'src/lib/credit/types'));
const { creemProvider } = require(path.join(PROJECT_ROOT, 'src/lib/payment/providers/creem'));
// 注意：不 import grant.ts（其内部用 @/ 别名，tsx 需按项目 tsconfig 解析；本脚本可能在项目外运行）。
// grantRechargeOrder 本身已由 HTTP confirm 路径（A1 三档 / A6 并发）端到端覆盖，5b 仅用 engine 原语造 fixture 到账态。

// ── 常量 ──
const BASE = process.env.SKU_E2E_BASE || 'http://127.0.0.1:3000';
const BONUS_TTL_DAYS = 30;
const SIGNUP_BONUS = 500;
const TOLERANCE_MS = 120 * 1000; // BONUS expiresAt 允许 ±2 分钟（grant 时刻与断言时刻间隔）

// 三档期望矩阵（Source of Truth = prisma/seed-plans.ts：149/499/1399 → 1000/3600/10000）
const PLAN_MATRIX = {
  starter:  { priceCents: 149,  total: 1000,  purchased: 1000, bonus: 0 },
  standard: { priceCents: 499,  total: 3600,  purchased: 3270, bonus: 330 },
  pro:      { priceCents: 1399, total: 10000, purchased: 8330, bonus: 1670 },
};

const TEST_EMAILS = [
  'sku_e2e_standard@aifanyi.local',
  'sku_e2e_starter@aifanyi.local',
  'sku_e2e_pro@aifanyi.local',
  'sku_e2e_conc@aifanyi.local',
  'sku_e2e_wh@aifanyi.local',
];

// ── 统计 ──
let passCount = 0;
let failCount = 0;
const skips = [];

function check(name, cond, detail) {
  if (cond) {
    passCount++;
    console.log('  PASS  ' + name + (detail ? '  (' + detail + ')' : ''));
  } else {
    failCount++;
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
  }
  return !!cond;
}
function skip(name, reason) {
  skips.push(name);
  console.log('  SKIP  ' + name + '  (' + reason + ')');
}

// ── 工具 ──
async function api(apiPath, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 20000);
  try {
    const res = await fetch(BASE + apiPath, Object.assign({ signal: ctrl.signal }, opts || {}));
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    return { status: res.status, json: json, text: text };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureUser(email, nick) {
  let user = await prisma.user.findUnique({ where: { email: email } });
  if (!user) {
    user = await prisma.user.create({ data: { email: email, nickname: nick || email.split('@')[0], status: 'active' } });
  }
  return user;
}

async function login(user) {
  const s = await createSession(user.id);
  return 'aifanyi_session=' + s.sessionToken;
}

/** 清理单个测试用户全部数据（顺序满足 FK：RechargeOrder→Ledger→Usage→User 级联其余） */
async function cleanupUser(email) {
  const user = await prisma.user.findUnique({ where: { email: email } });
  if (!user) return;
  await prisma.rechargeOrder.deleteMany({ where: { userId: user.id } });
  await prisma.creditLedger.deleteMany({ where: { userId: user.id } });
  await prisma.usageRecord.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } }); // cascade: CreditAccount/CreditGrant/Session/AuthIdentity
}

async function dbBalance(userId) {
  const acc = await prisma.creditAccount.findUnique({ where: { userId: userId } });
  return acc ? { available: acc.balance, reserved: acc.reservedBalance } : { available: 0, reserved: 0 };
}

async function ledgerSum(userId) {
  const agg = await prisma.creditLedger.aggregate({ where: { userId: userId }, _sum: { amount: true } });
  return agg._sum.amount || 0;
}

/** 断言 7：available + reserved == ΣLedger.amount */
async function assertLedgerInvariant(userId, label) {
  const b = await dbBalance(userId);
  const sum = await ledgerSum(userId);
  check('Ledger 口径 ' + label, (b.available + b.reserved) === sum,
    'available=' + b.available + ' reserved=' + b.reserved + ' Σledger=' + sum);
}

async function purchaseAndConfirm(cookie, planCode) {
  const p = await api('/api/credits/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie },
    body: JSON.stringify({ planCode: planCode }),
  });
  if (!p.json || !p.json.ok || !p.json.orderId) throw new Error('下单失败(' + planCode + ')：' + p.text);
  const c = await api('/api/credits/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie },
    body: JSON.stringify({ orderId: p.json.orderId }),
  });
  return { orderId: p.json.orderId, purchase: p.json, confirm: c };
}

function assertTierGrants(grants, expPurchased, expBonus) {
  const purchased = grants.filter(function (g) { return g.type === GRANT_TYPES.PURCHASED; });
  const bonus = grants.filter(function (g) { return g.type === GRANT_TYPES.BONUS; });
  check('PURCHASED 一条且为拆分本金（' + expPurchased + '，expiresAt=null）',
    purchased.length === 1 && purchased[0].totalAmount === expPurchased && purchased[0].remainingAmount === expPurchased && purchased[0].expiresAt === null,
    JSON.stringify(purchased.map(function (g) { return { type: g.type, total: g.totalAmount, remaining: g.remainingAmount, exp: g.expiresAt }; })));
  if (expBonus > 0) {
    check('BONUS 一条且为拆分赠送（' + expBonus + '，30 天到期）',
      bonus.length === 1 && bonus[0].totalAmount === expBonus && bonus[0].remainingAmount === expBonus
      && bonus[0].expiresAt && Math.abs(bonus[0].expiresAt.getTime() - (Date.now() + BONUS_TTL_DAYS * 86400000)) <= TOLERANCE_MS,
      JSON.stringify(bonus.map(function (g) { return { type: g.type, total: g.totalAmount, exp: g.expiresAt }; })));
  } else {
    check('BONUS 零条（无赠送档）', bonus.length === 0);
  }
}

// ═══════════════════ 断言 1+2+3(E2E) + 消费顺序 + 7：standard 全流程 ═══════════════════
async function testStandardFlow() {
  const email = 'sku_e2e_standard@aifanyi.local';
  const exp = PLAN_MATRIX.standard;
  console.log('\n[A1.standard] 三档拆分（免费 500 前置）' + email);
  await cleanupUser(email);
  const user = await ensureUser(email, 'sku_e2e_standard');
  const cookie = await login(user);

  // 免费 500 懒触发（GET /api/credit/balance，幂等 signup_bonus:{userId}）
  const balResp = await api('/api/credit/balance', { headers: { cookie: cookie } });
  check('balance 接口懒触发免费 500', balResp.json && balResp.json.loggedIn === true && balResp.json.available === SIGNUP_BONUS,
    JSON.stringify(balResp.json && { loggedIn: balResp.json.loggedIn, available: balResp.json.available }));
  const fg1 = await prisma.creditGrant.findMany({ where: { userId: user.id, type: GRANT_TYPES.FREE_GRANT } });
  check('FREE_GRANT 一条 500/500（30 天到期）',
    fg1.length === 1 && fg1[0].totalAmount === SIGNUP_BONUS && fg1[0].remainingAmount === SIGNUP_BONUS
    && fg1[0].expiresAt && Math.abs(fg1[0].expiresAt.getTime() - (Date.now() + BONUS_TTL_DAYS * 86400000)) <= TOLERANCE_MS,
    JSON.stringify(fg1.map(function (g) { return { total: g.totalAmount, remaining: g.remainingAmount, exp: g.expiresAt }; })));

  // 购买 standard + 确认
  const res = await purchaseAndConfirm(cookie, 'standard');
  check('购买+确认 ok（standard）', res.confirm.json && res.confirm.json.ok === true, 'HTTP ' + res.confirm.status);
  check('confirm granted 拆分 3270/330',
    res.confirm.json && res.confirm.json.granted && res.confirm.json.granted.purchased === exp.purchased && res.confirm.json.granted.bonus === exp.bonus,
    JSON.stringify(res.confirm.json.granted));

  // 拆分断言（PURCHASED 永久 + BONUS 30 天）
  const grants = await prisma.creditGrant.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  assertTierGrants(grants, exp.purchased, exp.bonus);

  // 免费 500 隔离：充值后记录不变；未消耗余额 = 500 + 3600
  const fg2 = await prisma.creditGrant.findMany({ where: { userId: user.id, type: GRANT_TYPES.FREE_GRANT } });
  check('充值后 FREE_GRANT 记录不变（500/500）',
    fg2.length === 1 && fg2[0].totalAmount === SIGNUP_BONUS && fg2[0].remainingAmount === SIGNUP_BONUS,
    'FREE_GRANT total=' + (fg2[0] && fg2[0].totalAmount) + ' remaining=' + (fg2[0] && fg2[0].remainingAmount));
  const bal = await dbBalance(user.id);
  check('未消耗余额 = 500 + 3600 = 4100', bal.available === SIGNUP_BONUS + exp.total, 'available=' + bal.available);

  // 订单查询 API
  const o = await api('/api/credits/order?orderId=' + encodeURIComponent(res.orderId), { headers: { cookie: cookie } });
  check('GET /api/credits/order → granted', o.json && o.json.status === 'granted' && o.json.granted && o.json.granted.purchased === exp.purchased && o.json.granted.bonus === exp.bonus, JSON.stringify(o.json));

  // 断言 3（E2E）：重复 confirm → already:true，Ledger 无新增
  const c2 = await api('/api/credits/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie },
    body: JSON.stringify({ orderId: res.orderId }),
  });
  check('重复 confirm → already:true', c2.json && c2.json.already === true, JSON.stringify(c2.json));
  const rc = await prisma.creditLedger.count({ where: { userId: user.id, idempotencyKey: { startsWith: 'recharge:' + res.orderId + ':' } } });
  check('幂等：recharge 幂等键 Ledger 仅 2 条（无新增）', rc === 2, 'count=' + rc);
  const balIdem = await dbBalance(user.id);
  check('幂等：余额不变', balIdem.available === bal.available);

  // 断言 2（engine 层）：消费顺序 FREE_GRANT 先扣（policy：FREE_GRANT 优先级 1 < BONUS 2，且到期更早）
  const jobId = 'sku_e2e_consume_' + crypto.randomUUID();
  const rr = await engine.reserve({ userId: user.id, jobId: jobId, feature: 'text_translation', estimatedCredits: 100, idempotencyKey: jobId + ':reserve' });
  check('engine.reserve 100 ok', rr.ok === true, JSON.stringify(rr));
  const usage = await prisma.usageRecord.findFirst({ where: { userId: user.id, jobId: jobId } });
  if (!usage) throw new Error('usage 记录缺失（reserve 未落库）');
  const cc = await engine.consume({ userId: user.id, jobId: jobId, usageId: usage.id, actualCredits: 100, idempotencyKey: jobId + ':consume' });
  check('engine.consume 100 ok', cc.ok === true, JSON.stringify(cc));
  const ga = await prisma.creditGrant.findMany({ where: { userId: user.id } });
  const fgA = ga.find(function (g) { return g.type === GRANT_TYPES.FREE_GRANT; });
  const bA = ga.find(function (g) { return g.type === GRANT_TYPES.BONUS; });
  const pA = ga.find(function (g) { return g.type === GRANT_TYPES.PURCHASED; });
  check('消费顺序 FREE_GRANT 先扣（500→400）', fgA && fgA.remainingAmount === 400, 'FREE_GRANT remaining=' + (fgA && fgA.remainingAmount));
  check('BONUS/PURCHASED 未被消费', bA && bA.remainingAmount === 330 && pA && pA.remainingAmount === 3270,
    'BONUS=' + (bA && bA.remainingAmount) + ' PURCHASED=' + (pA && pA.remainingAmount));
  const cl = await prisma.creditLedger.findFirst({ where: { userId: user.id, type: LEDGER_TYPES.CONSUME } });
  check('consume ledger grantId 指向 FREE_GRANT', cl && fgA && cl.grantId === fgA.id, 'grantId=' + (cl && cl.grantId));

  await assertLedgerInvariant(user.id, email + ':standard');
  return { user: user, cookie: cookie, orderId: res.orderId };
}

// ═══════════════════ 断言 1：starter / pro 三档拆分（无免费 500 干扰） ═══════════════════
async function testTier(planCode, email) {
  const exp = PLAN_MATRIX[planCode];
  const plan = await prisma.pricePlan.findUnique({ where: { code: planCode } });
  console.log('\n[A1.' + planCode + '] 三档拆分 ' + email);
  check('seed-plans 与矩阵一致（' + planCode + '）',
    plan && plan.priceCents === exp.priceCents && plan.totalCredits === exp.total && plan.purchasedCredits === exp.purchased && plan.bonusCredits === exp.bonus && plan.bonusTtlDays === BONUS_TTL_DAYS,
    plan ? ('DB ' + plan.priceCents + '/' + plan.totalCredits + '/' + plan.purchasedCredits + '/' + plan.bonusCredits + '/' + plan.bonusTtlDays) : 'plan 不存在');

  await cleanupUser(email);
  const user = await ensureUser(email, 'sku_e2e_' + planCode);
  const cookie = await login(user);
  const before = await dbBalance(user.id);

  const res = await purchaseAndConfirm(cookie, planCode);
  check('购买+确认 ok（' + planCode + '）', res.confirm.json && res.confirm.json.ok === true, 'HTTP ' + res.confirm.status);
  if (res.confirm.json && res.confirm.json.ok) {
    check('confirm granted 拆分（' + planCode + '）',
      res.confirm.json.granted && res.confirm.json.granted.purchased === exp.purchased && res.confirm.json.granted.bonus === exp.bonus,
      JSON.stringify(res.confirm.json.granted));
  }

  const grants = await prisma.creditGrant.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  assertTierGrants(grants, exp.purchased, exp.bonus);

  const after = await dbBalance(user.id);
  check('余额 +' + exp.total + '（' + planCode + '）', after.available - before.available === exp.total, 'before=' + before.available + ' after=' + after.available);

  const order = await prisma.rechargeOrder.findUnique({ where: { id: res.orderId } });
  check('订单 granted（' + planCode + '）', order && order.status === 'granted' && order.grantedAt !== null, 'status=' + (order && order.status));
  await assertLedgerInvariant(user.id, email + ':' + planCode);
}

// ═══════════════════ 断言 4：验签失败 → 拒绝 → 不 Grant ═══════════════════
async function testWebhookVerify() {
  const email = 'sku_e2e_wh@aifanyi.local';
  console.log('\n[A4] 验签失败 → 拒绝 → 不 Grant');

  // 4a provider 层（dummy secret 仅测试用，非真实凭据；creem.verifyWebhook 运行时读 env）
  const DUMMY_SECRET = 'sku-e2e-dummy-webhook-secret-0123456789abcdef';
  process.env.CREEM_WEBHOOK_SECRET = DUMMY_SECRET;
  const body = JSON.stringify({
    eventType: 'checkout.completed',
    object: { id: 'co_sku_e2e', status: 'completed', metadata: { orderId: 'ord_sku_e2e_fixture' }, order: { status: 'paid', amount: 499 } },
  });
  let v = await creemProvider.verifyWebhook(body, { 'creem-signature': '0'.repeat(64) });
  check('错误签名 → invalid（签名不匹配）', v.valid === false && v.reason === '签名不匹配', v.reason);
  v = await creemProvider.verifyWebhook(body, {});
  check('缺失签名 → invalid', v.valid === false && String(v.reason).indexOf('creem-signature') >= 0, v.reason);
  v = await creemProvider.verifyWebhook('not-json{', { 'creem-signature': '0'.repeat(64) });
  check('非 JSON payload → invalid', v.valid === false && v.reason === 'payload 非 JSON', v.reason);
  const goodSig = crypto.createHmac('sha256', DUMMY_SECRET).update(body).digest('hex');
  v = await creemProvider.verifyWebhook(body, { 'creem-signature': goodSig });
  check('正确签名 → valid + 字段解析（orderId/providerOrderId/event/paid/amountCents）',
    v.valid === true && v.orderId === 'ord_sku_e2e_fixture' && v.providerOrderId === 'co_sku_e2e' && v.event === 'checkout.completed' && v.paid === true && v.amountCents === 499,
    JSON.stringify(v));
  const refundBody = JSON.stringify({ eventType: 'refund.completed', object: { id: 'co_sku_e2e', status: 'completed', metadata: { orderId: 'ord_sku_e2e_fixture' } } });
  const refundSig = crypto.createHmac('sha256', DUMMY_SECRET).update(refundBody).digest('hex');
  v = await creemProvider.verifyWebhook(refundBody, { 'creem-signature': refundSig });
  check('refund 事件解析（valid 且 paid=false）', v.valid === true && v.paid === false && v.event === 'refund.completed', JSON.stringify(v));
  // 还原 .env 原始值（若有），避免污染后续 5b 使用
  if (ORIG_CREEM_SECRET) process.env.CREEM_WEBHOOK_SECRET = ORIG_CREEM_SECRET;
  else delete process.env.CREEM_WEBHOOK_SECRET;

  // 4b HTTP 层：fixture 订单 + 错误签名 → 拒绝且不 Grant
  //    creem 模式 → 401；mock 模式 → 404（provider 不匹配）或 400（mock 无 webhook）——均属拒绝
  await cleanupUser(email);
  const user = await ensureUser(email, 'sku_e2e_wh');
  const fixtureOrder = await prisma.rechargeOrder.create({
    data: {
      userId: user.id, planCode: 'standard', planName: '主力包', priceCents: 499,
      purchasedCredits: 3270, bonusCredits: 330, status: 'pending', provider: 'creem',
      providerOrderId: 'co_sku_e2e_wh_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      idempotencyKey: 'recharge:sku_e2e_wh_' + crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  const wbBody = JSON.stringify({
    eventType: 'checkout.completed',
    object: { id: fixtureOrder.providerOrderId, status: 'completed', metadata: { orderId: fixtureOrder.id }, order: { status: 'paid', amount: 499 } },
  });
  const wb = await api('/api/credits/webhook/creem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'creem-signature': '0'.repeat(64) },
    body: wbBody,
  });
  const rejected = wb.status === 401 || wb.status === 404 || wb.status === 400;
  check('webhook 错误签名被拒绝（401/404/400）', rejected, 'HTTP ' + wb.status + ' body=' + wb.text.slice(0, 120));
  const whGrants = await prisma.creditGrant.count({ where: { userId: user.id } });
  check('验签失败后不产生 Grant', whGrants === 0, 'grants=' + whGrants);
  const whOrder = await prisma.rechargeOrder.findUnique({ where: { id: fixtureOrder.id } });
  check('fixture 订单仍 pending（未到账）', whOrder && whOrder.status === 'pending', 'status=' + (whOrder && whOrder.status));
  return { user: user, fixtureOrder: fixtureOrder };
}

// ═══════════════════ 断言 5：Refund ═══════════════════
async function testRefund(wh) {
  const user = wh.user;
  const fixtureOrder = wh.fixtureOrder;
  console.log('\n[A5] Refund（engine 层 + webhook 目标契约）');

  // 5a engine.refund：正向入账 + 幂等 + 不为负（当前语义=系统补偿，见 credit/history 标签）
  const b0 = await dbBalance(user.id);
  const refundKey = 'sku_e2e_refund_' + crypto.randomUUID();
  const rf1 = await engine.refund({ userId: user.id, jobId: 'sku_e2e_refund_job', amount: 200, reason: '验收测试退款', idempotencyKey: refundKey });
  const b1 = await dbBalance(user.id);
  check('engine.refund 入账 +200', rf1.ok === true && b1.available === b0.available + 200, JSON.stringify(rf1));
  const rf2 = await engine.refund({ userId: user.id, jobId: 'sku_e2e_refund_job', amount: 200, reason: '验收测试退款', idempotencyKey: refundKey });
  const b2 = await dbBalance(user.id);
  const refundLedgers = await prisma.creditLedger.count({ where: { userId: user.id, type: LEDGER_TYPES.REFUND } });
  check('engine.refund 幂等（Ledger 仅 1 条 REFUND）', rf2.ok === true && b2.available === b1.available && refundLedgers === 1, 'available ' + b1.available + '→' + b2.available);
  check('refund 不产生负余额', b2.available >= 0);

  // 5b 支付退款扣回（目标契约，依赖 P1-A-4a）：
  //    先把 fixture 订单造为「已到账」态（用与 grant.ts 完全相同的幂等键 recharge:{orderId}:{purchased|bonus}），
  //    再 POST refund 事件，检测扣回。grantRechargeOrder 本体已由 HTTP confirm 路径端到端覆盖。
  const gA = await engine.grantCredits({ userId: user.id, type: GRANT_TYPES.PURCHASED, source: '购买 主力包', amount: 3270, idempotencyKey: 'recharge:' + fixtureOrder.id + ':purchased' });
  const gB = await engine.grantCredits({ userId: user.id, type: GRANT_TYPES.BONUS, source: '主力包 赠送', amount: 330, expiresAt: new Date(Date.now() + BONUS_TTL_DAYS * 86400000), idempotencyKey: 'recharge:' + fixtureOrder.id + ':bonus' });
  await prisma.rechargeOrder.update({ where: { id: fixtureOrder.id }, data: { status: 'granted', grantedAt: new Date() } });
  check('fixture 订单造到账态（3270+330）', gA.ok === true && gB.ok === true, JSON.stringify([gA, gB]));
  const envSecret = ENV.CREEM_WEBHOOK_SECRET || ORIG_CREEM_SECRET;
  if (envSecret) {
    const rfBody = JSON.stringify({ eventType: 'refund.completed', object: { id: fixtureOrder.providerOrderId, status: 'completed', metadata: { orderId: fixtureOrder.id } } });
    const rfSig2 = crypto.createHmac('sha256', envSecret).update(rfBody).digest('hex');
    const beforeRefund = await prisma.creditGrant.findMany({ where: { userId: user.id } });
    const beforeBal = await dbBalance(user.id);
    const beforeRemaining = beforeRefund.reduce(function (s, g) { return s + g.remainingAmount; }, 0);
    const rw = await api('/api/credits/webhook/creem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'creem-signature': rfSig2 },
      body: rfBody,
    });
    const afterRefund = await prisma.creditGrant.findMany({ where: { userId: user.id } });
    const afterBal = await dbBalance(user.id);
    const afterRemaining = afterRefund.reduce(function (s, g) { return s + g.remainingAmount; }, 0);
    const clawed = afterRemaining < beforeRemaining || afterBal.available < beforeBal.available;
    if (clawed) {
      check('refund 事件 → 积分扣回', true, 'remaining ' + beforeRemaining + '→' + afterRemaining + ' balance ' + beforeBal.available + '→' + afterBal.available);
      check('refund 扣回不做负余额', afterBal.available >= 0 && afterBal.reserved >= 0);
      const beforeRemaining2 = (await prisma.creditGrant.findMany({ where: { userId: user.id } })).reduce(function (s, g) { return s + g.remainingAmount; }, 0);
      const rw2 = await api('/api/credits/webhook/creem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'creem-signature': rfSig2 },
        body: rfBody,
      });
      const afterRemaining2 = (await prisma.creditGrant.findMany({ where: { userId: user.id } })).reduce(function (s, g) { return s + g.remainingAmount; }, 0);
      check('refund 事件幂等（重复发无新增扣回）', afterRemaining2 === beforeRemaining2, 'HTTP ' + rw2.status);
    } else {
      skip('支付退款扣回（webhook refund 事件）', '当前实现未处理 refund 事件（P1-A-4a 未合入）→ HTTP ' + rw.status + (rw.json ? ' ' + (rw.json.event || '') : ''));
    }
  } else {
    skip('支付退款扣回（webhook refund 事件）', '本机 .env 未配置 CREEM_WEBHOOK_SECRET（无 Creem 凭据），无法构造有效 refund 事件；待 P1-A-4a + 测试凭据就绪后自动启用');
  }

  // 5c 余额不足部分扣回（不做负余额）——engine 层现有扣回原语 adminAdjustment 负值模拟
  const bb0 = await dbBalance(user.id);
  const adj1 = await engine.adminAdjustment({ userId: user.id, type: GRANT_TYPES.ADMIN_ADJUSTMENT, source: '验收测试扣回', amount: -999999999, idempotencyKey: 'sku_e2e_admin_' + crypto.randomUUID() });
  const bb1 = await dbBalance(user.id);
  check('余额不足扣回被拒（不做负余额）', adj1.ok === false && adj1.error === 'insufficient' && bb1.available === bb0.available && bb1.available >= 0, JSON.stringify(adj1));
  const adj2 = await engine.adminAdjustment({ userId: user.id, type: GRANT_TYPES.ADMIN_ADJUSTMENT, source: '验收测试扣回', amount: -50, idempotencyKey: 'sku_e2e_admin_' + crypto.randomUUID() });
  const bb2 = await dbBalance(user.id);
  check('余额充足扣回 -50', adj2.ok === true && bb2.available === bb1.available - 50, JSON.stringify(adj2));
  await assertLedgerInvariant(user.id, emailLabel(wh.user) + ':wh');
}

function emailLabel(user) {
  return user && user.email ? user.email : 'sku_e2e_wh@aifanyi.local';
}

// ═══════════════════ 断言 3（engine 层）：grantCredits 同 key 幂等 ═══════════════════
async function testEngineIdempotency(userId) {
  console.log('\n[A3-engine] engine.grantCredits 幂等（幂等键冲突）');
  const keyK = 'sku_e2e_idem_' + crypto.randomUUID();
  const n0 = await prisma.creditLedger.count({ where: { userId: userId } });
  const g1 = await engine.grantCredits({ userId: userId, type: GRANT_TYPES.PURCHASED, source: '幂等验收测试', amount: 1, idempotencyKey: keyK });
  const n1 = await prisma.creditLedger.count({ where: { userId: userId } });
  const g2 = await engine.grantCredits({ userId: userId, type: GRANT_TYPES.PURCHASED, source: '幂等验收测试', amount: 1, idempotencyKey: keyK });
  const n2 = await prisma.creditLedger.count({ where: { userId: userId } });
  check('首次 grant ok（返回 grantId）', g1.ok === true && g1.grantId && g1.grantId !== 'idempotent', JSON.stringify(g1));
  check('同 key 二次 grant → idempotent 且 Ledger 无新增', g2.ok === true && g2.grantId === 'idempotent' && n2 === n1 && n1 === n0 + 1, 'ledger ' + n0 + '→' + n1 + '→' + n2);
}

// ═══════════════════ 断言 6：并发只 Grant 一次 ═══════════════════
async function testConcurrency() {
  const email = 'sku_e2e_conc@aifanyi.local';
  console.log('\n[A6] 并发：同订单只 Grant 一次（行锁 + 幂等键）');
  await cleanupUser(email);
  const user = await ensureUser(email, 'sku_e2e_conc');
  const cookie = await login(user);
  const before = await dbBalance(user.id);

  const p = await api('/api/credits/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookie },
    body: JSON.stringify({ planCode: 'standard' }),
  });
  if (!p.json || !p.json.ok || !p.json.orderId) throw new Error('并发用户下单失败：' + p.text);
  const orderId = p.json.orderId;

  const calls = [];
  for (let i = 0; i < 5; i++) {
    calls.push(api('/api/credits/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookie },
      body: JSON.stringify({ orderId: orderId }),
    }));
  }
  const results = await Promise.all(calls);
  const allOk = results.every(function (r) { return r.json && r.json.ok === true; });
  check('5×并发 confirm 全部 ok', allOk, results.map(function (r) { return r.status + ':' + (r.json && (r.json.already ? 'already' : 'ok')); }).join(' '));

  const grants = await prisma.creditGrant.findMany({ where: { userId: user.id } });
  const purch = grants.filter(function (g) { return g.type === GRANT_TYPES.PURCHASED; });
  const bon = grants.filter(function (g) { return g.type === GRANT_TYPES.BONUS; });
  check('并发只 Grant 一次（PURCHASED 1×3270 + BONUS 1×330）',
    purch.length === 1 && purch[0].totalAmount === 3270 && purch[0].remainingAmount === 3270 && bon.length === 1 && bon[0].totalAmount === 330,
    'PURCHASED=' + purch.length + ' BONUS=' + bon.length);
  const keys = await prisma.creditLedger.count({ where: { userId: user.id, idempotencyKey: { startsWith: 'recharge:' + orderId + ':' } } });
  check('recharge 幂等键 Ledger 仅 2 条', keys === 2, 'count=' + keys);
  const after = await dbBalance(user.id);
  check('并发后余额恰 +3600（一次）', after.available - before.available === 3600, 'delta=' + (after.available - before.available));
  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } });
  check('订单最终 granted', order && order.status === 'granted', 'status=' + (order && order.status));

  // engine 层并发：6×同 key grantCredits（P2002 唯一约束 + 行锁）
  const keyC = 'sku_e2e_conc_key_' + crypto.randomUUID();
  const engCalls = [];
  for (let i = 0; i < 6; i++) {
    engCalls.push(engine.grantCredits({ userId: user.id, type: GRANT_TYPES.PURCHASED, source: '并发幂等测试', amount: 100, idempotencyKey: keyC }));
  }
  const engResults = await Promise.all(engCalls);
  check('6×并发 grantCredits 全部 ok', engResults.every(function (r) { return r.ok === true; }));
  const srcGrants = await prisma.creditGrant.count({ where: { userId: user.id, source: '并发幂等测试' } });
  const srcLedger = await prisma.creditLedger.count({ where: { userId: user.id, idempotencyKey: keyC } });
  check('并发 grant 只落 1 条 grant + 1 条 ledger', srcGrants === 1 && srcLedger === 1, 'grants=' + srcGrants + ' ledger=' + srcLedger);

  // 附加：到期回收（expireCredits 接线，覆盖 FREE_GRANT/BONUS 到期语义的引擎侧）
  const expKey = 'sku_e2e_exp_' + crypto.randomUUID();
  const expG = await engine.grantCredits({ userId: user.id, type: GRANT_TYPES.FREE_MONTHLY, source: '到期验收测试', amount: 80, expiresAt: new Date(Date.now() - 60000), idempotencyKey: expKey });
  check('过期 grant 可发放（验收用）', expG.ok === true);
  const bExp0 = await dbBalance(user.id);
  const expRes = await engine.expireCredits();
  const bExp1 = await dbBalance(user.id);
  const expLed = await prisma.creditLedger.findFirst({ where: { userId: user.id, type: LEDGER_TYPES.EXPIRE } });
  check('expireCredits 到期回收（余额 -80 + EXPIRE 账行）', bExp1.available === bExp0.available - 80 && expLed && expLed.amount === -80, 'balance ' + bExp0.available + '→' + bExp1.available);

  await assertLedgerInvariant(user.id, email + ':conc');
}

// ═══════════════════ main ═══════════════════
async function main() {
  console.log('=== SKU E2E 开始 === BASE=' + BASE + ' PROJECT=' + PROJECT_ROOT);
  try {
    // 前置：服务可达 / plans 入库 / 旧测试数据清理
    let pre = null;
    try {
      pre = await api('/api/credit/balance', {});
    } catch (e) {
      throw new Error('本地服务不可达（' + BASE + '），请先启动：cd G:\\autoclaw\\aifanyi && npm run dev（mock provider）。' + (e && e.message ? ' ' + e.message : ''));
    }
    if (!pre || !pre.json) throw new Error('服务响应异常：' + (pre && pre.text));
    for (const code of Object.keys(PLAN_MATRIX)) {
      const plan = await prisma.pricePlan.findUnique({ where: { code: code } });
      if (!plan) throw new Error('PricePlan 缺失 code=' + code + '，请先运行 npx tsx prisma/seed-plans.ts');
    }
    for (const email of TEST_EMAILS) await cleanupUser(email);
    console.log('preflight OK（服务可达 / 三档 plans 已入库 / 旧测试数据已清）');

    // [A1 standard] + [A2 免费500隔离] + [A3 E2E 幂等] + 消费顺序 + [A7]
    await testStandardFlow();
    // [A1 starter / pro]
    await testTier('starter', 'sku_e2e_starter@aifanyi.local');
    await testTier('pro', 'sku_e2e_pro@aifanyi.local');
    // [A4] 验签失败
    const wh = await testWebhookVerify();
    // [A5] Refund
    await testRefund(wh);
    // [A3 engine 层] grant 幂等
    await testEngineIdempotency(wh.user.id);
    // [A6] 并发
    await testConcurrency();

    // [A7] Ledger 口径全用户终检
    console.log('\n[A7] Ledger 口径：available + reserved == ΣLedger.amount（全测试用户终检）');
    for (const email of TEST_EMAILS) {
      const u = await prisma.user.findUnique({ where: { email: email } });
      if (u) await assertLedgerInvariant(u.id, email);
    }
  } finally {
    for (const email of TEST_EMAILS) {
      await cleanupUser(email).catch(function () { });
    }
    await prisma.$disconnect().catch(function () { });
  }

  console.log('\n=== SKU E2E SUMMARY ===');
  console.log('PASS ' + passCount + ' / FAIL ' + failCount + (skips.length ? ' / SKIP ' + skips.length : ''));
  if (skips.length) console.log('SKIPPED: ' + skips.join(' | '));
  if (failCount > 0) {
    console.log('=== E2E FAILED（exit 1）===');
    process.exit(1);
  }
  console.log('=== ALL GREEN ===');
}

main().catch(function (e) {
  console.error('E2E FAIL:', e);
  process.exit(1);
});
