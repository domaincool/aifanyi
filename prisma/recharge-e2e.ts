/**
 * P1 充值 E2E：登录态下单 → 模拟确认 → 到账 → 幂等
 * 运行（服务器）：npx tsx prisma/recharge-e2e.ts
 * 覆盖：purchase 下单 / confirm 到账 PURCHASED / 重复确认幂等 / 余额正确
 */
import * as fs from 'fs';
// 手动加载 .env（tsx 独立脚本不自动加载）
const env = fs.readFileSync('.env', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { prisma } = await import('../src/lib/db');
const { createSession } = await import('../src/lib/auth/session');

const BASE = 'http://127.0.0.1:3000';

async function main() {
  // 1) 造测试用户 + 清空 credit 数据 + 生成 session
  const email = 'recharge_e2e@aifanyi.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) user = await prisma.user.create({ data: { email, nickname: 'recharge_e2e', status: 'active' } });
  await prisma.creditLedger.deleteMany({ where: { userId: user.id } });
  await prisma.creditGrant.deleteMany({ where: { userId: user.id } });
  await prisma.creditAccount.deleteMany({ where: { userId: user.id } });
  await prisma.rechargeOrder.deleteMany({ where: { userId: user.id } });
  const { sessionToken } = await createSession(user.id);
  const cookie = `aifanyi_session=${sessionToken}`;

  // 2) 初始余额应为 0
  let r = await fetch(`${BASE}/api/credit/balance`, { headers: { cookie } });
  let j = await r.json();
  console.log('[1] 初始余额: ' + (j.available ?? JSON.stringify(j)));

  // 3) 下单 starter（¥5.9 / 590 积分，0 赠送）
  r = await fetch(`${BASE}/api/credits/purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ planCode: 'starter' }) });
  j = await r.json();
  console.log('[2] 下单 starter: ' + JSON.stringify(j));
  if (!j.ok || !j.orderId) throw new Error('下单失败');
  const orderId = j.orderId;

  // 4) 确认支付 → 到账
  r = await fetch(`${BASE}/api/credits/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ orderId }) });
  j = await r.json();
  console.log('[3] 确认到账: ' + JSON.stringify(j));
  if (!j.ok) throw new Error('确认失败');

  // 5) 余额应为 590
  r = await fetch(`${BASE}/api/credit/balance`, { headers: { cookie } });
  j = await r.json();
  console.log('[4] 到账后余额: ' + j.available + '（应 590）');
  console.log('    积分来源: ' + JSON.stringify((j.grants || []).map((g: any) => ({ source: g.source, remaining: g.remaining, total: g.total, exp: g.expiresAt }))));

  // 6) 重复确认 → 幂等（already:true，不重复 grant）
  r = await fetch(`${BASE}/api/credits/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ orderId }) });
  j = await r.json();
  console.log('[5] 重复确认(幂等): ' + JSON.stringify(j));

  // 7) 余额不变（仍 590）
  r = await fetch(`${BASE}/api/credit/balance`, { headers: { cookie } });
  j = await r.json();
  console.log('[6] 幂等后余额: ' + j.available + '（应仍 590）');

  // 8) 订单状态 granted
  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } });
  console.log('[7] 订单状态: ' + order?.status + '（应 granted）');

  console.log('=== RECHARGE E2E DONE ===');
}

main().catch((e) => { console.error('E2E FAIL:', e); process.exit(1); });
