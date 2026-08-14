/**
 * Phase B E2E 验收（服务器上跑：node scripts/phase-b-e2e.cjs）
 * 覆盖验收标准 1-7：导入/幂等/双风格冲突/鉴权/审计/线上可见性/回归
 */
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:3000';
const SITE = 'https://aifanyi.com';

// 读 .env
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const t = fs.readFileSync(envPath, 'utf8');
  const get = (k) => {
    const m = t.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim() : '';
  };
  return { token: get('OPS_API_TOKEN') };
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
  try { data = await res.json(); } catch { /* 非 JSON */ }
  return { status: res.status, data };
}

(async () => {
  const { token } = loadEnv();
  if (!token) { console.error('❌ .env 无 OPS_API_TOKEN'); process.exit(1); }
  console.log('Phase B E2E 开始（token 长度 ' + token.length + '）\n');

  const suffix = Date.now().toString(36).slice(-6);
  const t = (n) => `PhaseB${suffix}${n}`;
  const s = (n) => `phaseb-${suffix}-${n}`;
  const batchId = `e2e-batch-${suffix}`;

  // 1. 鉴权
  console.log('— 1. 鉴权 —');
  let r = await api('/api/admin/memes/import', { method: 'POST', body: { batchId: 'x', items: [] } });
  check('无 token → 401', r.status === 401);
  r = await api('/api/admin/memes/import', { method: 'POST', token: 'wrong-token-xxx', body: { batchId: 'x', items: [] } });
  check('错 token → 401', r.status === 401);
  r = await api('/api/admin/memes', { method: 'GET' });
  check('列表无 token → 401', r.status === 401);

  // 2. dryRun 预览（3 新 + 1 重复 term + 1 双风格 slug 冲突）
  console.log('\n— 2. dryRun 预览 —');
  const items = [
    { term: t('A'), slug: s('a'), meaning: 'PhaseB 测试词 A', translation: 'Test A EN', examples: [{ zh: '例句A', en: 'Example A' }], tags: ['测试'], popularity: 1 },
    { term: t('B'), slug: s('b'), meaning: 'PhaseB 测试词 B', translation: 'Test B EN', tags: ['测试'], popularity: 2 },
    { term: t('C'), slug: s('c'), meaning: 'PhaseB 测试词 C', translation: 'Test C EN', tags: ['测试'], popularity: 3 },
    { term: 'YYDS', slug: 'yyds-dup', meaning: '重复', translation: 'Dup', tags: [], popularity: 0 }, // term 重复
    { term: t('D'), slug: 'yue-guang-zu', meaning: '双风格冲突', translation: 'Conflict', tags: [], popularity: 0 }, // 撞已有 yueguangzu
  ];
  r = await api('/api/admin/memes/import', { method: 'POST', token, body: { batchId, items, dryRun: true, updateExisting: false } });
  check('dryRun 200', r.status === 200, JSON.stringify(r.data && { imported: r.data.imported, skipped: r.data.skipped, conflicts: r.data.conflicts && r.data.conflicts.length }));
  check('dryRun 可导入 3', r.data && r.data.imported === 3);
  check('dryRun 跳过重复 term 1', r.data && r.data.skipped === 1);
  check('dryRun 检出双风格冲突', r.data && r.data.conflicts.some((c) => c.reason === 'slug_conflict(yueguangzu)'), JSON.stringify(r.data && r.data.conflicts));

  // 3. 正式导入
  console.log('\n— 3. 正式导入 —');
  r = await api('/api/admin/memes/import', { method: 'POST', token, body: { batchId, items, dryRun: false, updateExisting: false } });
  check('导入 200', r.status === 200);
  check('imported=3', r.data && r.data.imported === 3);
  check('skipped=1', r.data && r.data.skipped === 1);
  check('conflicts=1', r.data && r.data.conflicts.length === 1);

  // 4. 幂等
  console.log('\n— 4. batchId 幂等 —');
  r = await api('/api/admin/memes/import', { method: 'POST', token, body: { batchId, items, dryRun: false, updateExisting: false } });
  check('重复提交 200', r.status === 200);
  check('repeated=true', r.data && r.data.repeated === true);
  check('未重复入库 imported 仍=3', r.data && r.data.imported === 3);

  // 5. 列表验证
  console.log('\n— 5. 列表查询 —');
  r = await api('/api/admin/memes?q=' + t('A'), { token });
  check('搜索命中 1 条', r.status === 200 && r.data && r.data.total === 1, 'status ' + r.status);

  // 6. 线上可见性
  console.log('\n— 6. 线上可见性 —');
  const page = await fetch(SITE + '/meme/' + s('a'));
  check('词条页 200', page.status === 200);
  const sitemap = await (await fetch(SITE + '/sitemap.xml')).text();
  check('sitemap 收录', sitemap.includes('/meme/' + s('a')));

  // 7. 审计日志
  console.log('\n— 7. 审计日志 —');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const logs = await prisma.adminLog.findMany({ where: { action: 'memes.import', batchId }, orderBy: { createdAt: 'desc' }, take: 5 });
  check('AdminLog 有导入记录', logs.length >= 1);
  check('operator=ops-token', logs.length >= 1 && logs[0].operator === 'ops-token');
  check('result 有 imported=3', logs.length >= 1 && logs[0].result && logs[0].result.imported === 3);

  // 8. 编辑 / 上下架
  console.log('\n— 8. 编辑与上下架 —');
  const memes = await prisma.memeEntry.findMany({ where: { term: { startsWith: 'PhaseB' + suffix } }, select: { id: true, term: true, status: true } });
  check('查到 3 条测试词条', memes.length === 3);
  if (memes.length >= 1) {
    r = await api('/api/admin/memes/' + memes[0].id, { method: 'PATCH', token, body: { status: 'archived' } });
    check('下架 200', r.status === 200);
    const page2 = await fetch(SITE + '/meme/' + s('a'), { redirect: 'manual' });
    check('下架后词条页 404', page2.status === 404, 'HTTP ' + page2.status);
  }

  // 9. 回归
  console.log('\n— 9. 回归 —');
  const home = await fetch(SITE + '/');
  check('首页 200', home.status === 200);
  const memeIndex = await fetch(SITE + '/meme');
  check('/meme 200', memeIndex.status === 200);
  const blindtest = await fetch(SITE + '/blindtest');
  check('/blindtest 200', blindtest.status === 200);

  // 10. 清理（软删测试词条，保留审计）
  console.log('\n— 10. 清理 —');
  for (const m of memes) {
    if (m.status !== 'archived') await prisma.memeEntry.update({ where: { id: m.id }, data: { status: 'archived' } });
  }
  const remain = await prisma.memeEntry.count({ where: { term: { startsWith: 'PhaseB' + suffix }, status: 'published' } });
  check('测试词条全部下架', remain === 0);
  await prisma.$disconnect();

  console.log('\n════════════════════════════════');
  console.log(`结果：${passed} 通过 / ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error('E2E 异常:', e); process.exit(1); });
