/**
 * P1 充值 E2E：登录态下单 → 模拟确认 → 到账 → 幂等
 * 运行（服务器）：npx tsx prisma/recharge-e2e.ts
 * cjs 兼容：纯 require 风格，避免 top-level await
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');

// 手动加载 .env（必须在 require 业务模块之前，保证 SESSION_SECRET 就绪）
const envContent = fs.readFileSync('.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { prisma } = require('../src/lib/db');
const { createSession } = require('../src/lib/auth/session');

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
  const cookie = 'aifanyi_session=' + sessionToken;

  // 2) 初始余额应为 0
  let r = await fetch(BASE + '/api/credit/balance', { headers: { cookie } });
  let j = await r.json();
  console.log('[1] 初始余额: ' + (j.available ?? JSON.stringify(j)));

  // 3) 下单 starter（¥5.9 / 590 积分，0 赠送）
  r = await fetch(BASE + '/api/credits/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ planCode: 'starter' }) });
  j = await r.json();
  console.log('[2] 下单 starter: ' + JSON.stringify(j));
  if (!j.ok || !j.orderId) throw new Error('下单失败');
  const orderId = j.orderId;

  // 4) 确认支付 → 到账
  r = await fetch(BASE + '/api/credits/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ orderId }) });
  j = await r.json();
  console.log('[3] 确认到账: ' + JSON.stringify(j));
  if (!j.ok) throw new Error('确认失败');

  // 5) 余额应为 590
  r = await fetch(BASE + '/api/credit/balance', { headers: { cookie } });
  j = await r.json();
  console.log('[4] 到账后余额: ' + j.available + '（应 590）');
  console.log('    积分来源: ' + JSON.stringify((j.grants || []).map(function (g) { return { source: g.source, remaining: g.remaining, total: g.total, exp: g.expiresAt }; })));

  // 6) 重复确认 → 幂等（already:true，不重复 grant）
  r = await fetch(BASE + '/api/credits/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ orderId }) });
  j = await r.json();
  console.log('[5] 重复确认(幂等): ' + JSON.stringify(j));

  // 7) 余额不变（仍 590）
  r = await fetch(BASE + '/api/credit/balance', { headers: { cookie } });
  j = await r.json();
  console.log('[6] 幂等后余额: ' + j.available + '（应仍 590）');

  // 8) 订单状态 granted
  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } });
  console.log('[7] 订单状态: ' + order.status + '（应 granted）');

  console.log('=== RECHARGE E2E DONE ===');
}

main().catch(function (e) { console.error('E2E FAIL:', e); process.exit(1); });
