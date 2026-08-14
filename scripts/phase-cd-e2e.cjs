/**
 * Phase C/D E2E 验收（服务器上跑：node scripts/phase-cd-e2e.cjs）
 * 覆盖：stats 认证 / 盲测管理（创建/列表/上下架）/ 审计日志 / 前台过滤
 */
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:3000';
const SITE = 'https://aifanyi.com';

function loadEnv() {
  const t = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const m = t.match(/^OPS_API_TOKEN=(.*)$/m);
  return { token: m ? m[1].trim() : '' };
}

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✅ ' + name + (extra ? ' — ' + extra : '')); }
  else { failed++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}

async function api(pathname, opts = {}) {
  const res = await fetch(BASE + pathname, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}), ...(opts.headers || {}) },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    method: opts.method || 'GET',
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

(async () => {
  const { token } = loadEnv();
  if (!token) { console.error('❌ .env 无 OPS_API_TOKEN'); process.exit(1); }
  console.log('Phase C/D E2E 开始\n');

  // 1. stats 认证
  console.log('— 1. /api/stats 认证 —');
  let r = await api('/api/stats');
  check('无 token → 401', r.status === 401);
  r = await api('/api/stats', { token });
  check('带 token → 200', r.status === 200);
  check('含用户/内容新字段', r.data && r.data.users && r.data.content && r.data.content.memesByStatus);

  // 2. 盲测管理
  console.log('\n— 2. 盲测创建/列表 —');
  const suffix = Date.now().toString(36).slice(-6);
  const testText = `PhaseCD测试盲测${suffix}：这句话用来验收管理后台盲测创建功能，三个模型都要能翻译。`;
  r = await api('/api/admin/blindtests', { method: 'POST', token, body: { sourceText: testText, sourceLang: 'zh', targetLang: 'en' } });
  check('创建 200（三模型生成）', r.status === 200, r.data && r.data.id ? 'id=' + r.data.id : JSON.stringify(r.data));
  check('译文 3 份匿名', r.data && r.data.translations && r.data.translations.length === 3);
  const btId = r.data && r.data.id;

  // 去重
  r = await api('/api/admin/blindtests', { method: 'POST', token, body: { sourceText: testText, sourceLang: 'zh', targetLang: 'en' } });
  check('重复原文 → 409 去重', r.status === 409);

  // 列表
  r = await api('/api/admin/blindtests?q=' + encodeURIComponent(testText.slice(0, 20)), { token });
  check('列表搜索命中', r.status === 200 && r.data.total === 1);

  // 3. 前台可见性
  console.log('\n— 3. 前台可见性 —');
  let page = await fetch(SITE + '/blindtest/' + btId);
  check('盲测详情页 200', page.status === 200, 'HTTP ' + page.status);

  // 4. 上下架
  console.log('\n— 4. 上下架 —');
  r = await api('/api/admin/blindtests/' + btId, { method: 'PATCH', token, body: { status: 'archived' } });
  check('下架 200', r.status === 200);
  page = await fetch(SITE + '/blindtest/' + btId, { redirect: 'manual' });
  check('下架后详情页 404', page.status === 404, 'HTTP ' + page.status);
  // 前台列表不含
  const listPage = await (await fetch(SITE + '/api/blindtest?limit=50')).json();
  check('前台列表不含已下架', !(listPage.list || []).some((b) => b.id === btId));

  // 5. 审计日志
  console.log('\n— 5. 审计日志 —');
  r = await api('/api/admin/audit?action=blindtests', { token });
  check('审计含盲测操作', r.status === 200 && r.data.logs.length >= 2, 'logs=' + (r.data.logs || []).length);
  check('审计 operator=ops-token', r.data.logs.every((l) => l.operator === 'ops-token'));

  // 6. 用户列表增强
  console.log('\n— 6. 用户列表增强 —');
  r = await api('/api/admin/credits/users', { token });
  check('用户列表含 authProvider/lastActive', r.status === 200 && r.data.users.length >= 1 && ('authProvider' in r.data.users[0]) && ('lastActive' in r.data.users[0]), 'users=' + r.data.users.length);

  // 7. 清理
  console.log('\n— 7. 清理 —');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.blindtest.update({ where: { id: btId }, data: { status: 'archived' } });
  const remain = await prisma.blindtest.count({ where: { sourceText: { contains: 'PhaseCD测试盲测' }, status: 'published' } });
  check('测试盲测题已下架', remain === 0);
  await prisma.$disconnect();

  console.log('\n════════════════════════════════');
  console.log(`结果：${passed} 通过 / ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error('E2E 异常:', e); process.exit(1); });
