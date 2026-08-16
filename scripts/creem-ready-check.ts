/**
 * Creem 接入就绪检查（凭据到达前/后均可运行，不调用 Creem API，纯本地可证伪检查）
 * 运行：npx tsx scripts/creem-ready-check.ts   （本地 G:\autoclaw\aifanyi 或服务器 /opt/aifanyi 均可）
 *
 * 检查内容：
 *   1. .env 中 5 个 Creem 凭据是否齐全（CREEM_API_KEY / PRODUCT_STARTER / PRODUCT_STANDARD / PRODUCT_PRO / WEBHOOK_SECRET）
 *   2. CREEM_API_KEY 环境前缀提示（creem_test_ = 测试环境 / creem_live_ = 生产环境，官方 CLI 文档口径）
 *   3. PAYMENT_PROVIDER 当前值提示（应待凭据到达后改为 creem）
 *   4. PricePlan 表三档（starter/standard/pro）与 seed-plans.ts 常量是否一致（价格/积分/赠送/排序/状态）
 *   5. 打印 dashboard 手动步骤清单（三 SKU 比对 + webhook 配置）
 *
 * 退出码：0 = 凭据齐全且三档一致（可上线）；1 = 有缺失或不一致（需处理）
 *
 * 注意：tsx 独立运行不自动加载 .env，脚本手动解析项目根 .env（幂等，不覆盖已存在环境变量）。
 */
import { prisma } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

/** 与 prisma/seed-plans.ts 保持一致的 Source of Truth（V1.2 最终版） */
const EXPECTED_PLANS = [
  { code: 'starter',  name: '入门包', priceCents: 149,  totalCredits: 1000,  purchasedCredits: 1000, bonusCredits: 0,    bonusTtlDays: 30, badge: null,      description: '首次体验 · 平价补量',            sortOrder: 1, active: true },
  { code: 'standard', name: '主力包', priceCents: 499,  totalCredits: 3600,  purchasedCredits: 3270, bonusCredits: 330,  bonusTtlDays: 30, badge: '热销',    description: '多送 330 积分 · 轻度付费主力',    sortOrder: 2, active: true },
  { code: 'pro',      name: '重度包', priceCents: 1399, totalCredits: 10000, purchasedCredits: 8330, bonusCredits: 1670, bonusTtlDays: 30, badge: '最划算',  description: '多送 1670 积分 · 跨境/重度用户',   sortOrder: 3, active: true },
];

/** 必填的 5 个 Creem 凭据 */
const REQUIRED_ENV = [
  'CREEM_API_KEY',
  'CREEM_PRODUCT_STARTER',
  'CREEM_PRODUCT_STANDARD',
  'CREEM_PRODUCT_PRO',
  'CREEM_WEBHOOK_SECRET',
];

/** 手动解析项目根 .env（tsx 不自动加载）；已存在的环境变量优先，不覆盖 */
function loadDotEnv() {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
    path.join(__dirname, '.env'), // 脚本自身目录（健壮性兜底）
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      if (key.startsWith('#') || key in process.env) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
    console.log(`[info] 已加载环境变量文件：${p}`);
    return;
  }
  console.log('[warn] 未找到 .env 文件（当前目录及其上级），仅使用进程环境变量');
}

interface PlanRow {
  code: string;
  name: string;
  priceCents: number;
  totalCredits: number;
  purchasedCredits: number;
  bonusCredits: number;
  bonusTtlDays: number;
  badge: string | null;
  description: string | null;
  active: boolean;
  sortOrder: number;
}

async function main() {
  loadDotEnv();
  console.log('═══════════ Creem 接入就绪检查 ═══════════\n');
  let fail = false;

  // ── 1. 凭据检查 ──
  console.log('【1/4】.env Creem 凭据检查');
  const missing: string[] = [];
  for (const key of REQUIRED_ENV) {
    const v = process.env[key];
    if (!v || !v.trim()) {
      missing.push(key);
      console.log(`  ✗ ${key}：未设置`);
    } else {
      console.log(`  ✓ ${key}：已设置（长度 ${v.trim().length}，值不展示）`);
    }
  }
  if (missing.length > 0) {
    console.log(`\n  结果：缺失 ${missing.length}/${REQUIRED_ENV.length} 项 → ${missing.join(', ')}`);
    console.log('  → 等待用户从 Creem Dashboard 取得后填入 .env（见 README.md 步骤 1）');
    fail = true;
  } else {
    console.log('  → 5 项凭据齐全 ✓');
  }

  // ── 2. API key 环境提示 ──
  console.log('\n【2/4】CREEM_API_KEY 环境识别（仅提示，不阻塞）');
  const apiKey = (process.env.CREEM_API_KEY || '').trim();
  if (apiKey) {
    if (apiKey.startsWith('creem_test_')) {
      console.log('  → 测试环境 key（creem_test_ 前缀）：下单将打到 https://test-api.creem.io，请用测试卡支付');
    } else if (apiKey.startsWith('creem_live_')) {
      console.log('  → 生产环境 key（creem_live_ 前缀）：下单将打到 https://api.creem.io，将产生真实扣款');
    } else {
      console.log(`  → 无法识别前缀（官方口径 creem_test_/creem_live_），请到 Dashboard 核对 key 环境`);
    }
  }
  const provider = (process.env.PAYMENT_PROVIDER || '').toLowerCase();
  console.log(`  → PAYMENT_PROVIDER 当前值：${provider || '(未设置)'}${provider === 'creem' ? '（已切 Creem ✓）' : '（上线前需改为 creem）'}`);

  // ── 3. PricePlan 表一致性 ──
  console.log('\n【3/4】PricePlan 表三档与 seed-plans.ts 常量一致性');
  const rows = (await prisma.pricePlan.findMany({
    where: { code: { in: EXPECTED_PLANS.map(p => p.code) } },
    orderBy: { sortOrder: 'asc' },
  })) as unknown as PlanRow[];

  const byCode = new Map(rows.map(r => [r.code, r]));
  const FIELDS: (keyof PlanRow)[] = ['name', 'priceCents', 'totalCredits', 'purchasedCredits', 'bonusCredits', 'bonusTtlDays', 'badge', 'description', 'sortOrder', 'active'];

  for (const exp of EXPECTED_PLANS) {
    const row = byCode.get(exp.code);
    if (!row) {
      console.log(`  ✗ ${exp.code}（${exp.name}）：表中不存在！请先运行 npx tsx prisma/seed-plans.ts`);
      fail = true;
      continue;
    }
    const diffs: string[] = [];
    for (const f of FIELDS) {
      const ev = (exp as unknown as Record<string, unknown>)[f];
      const rv = row[f];
      if (String(ev) !== String(rv)) diffs.push(`${f}: 期望 ${String(ev)} ≠ 实际 ${String(rv)}`);
    }
    if (diffs.length === 0) {
      console.log(`  ✓ ${exp.code}（${exp.name}）：与 seed 常量完全一致（$${(exp.priceCents / 100).toFixed(2)} → ${exp.totalCredits} 积分）`);
    } else {
      console.log(`  ✗ ${exp.code}（${exp.name}）：不一致 → ${diffs.join('；')}`);
      fail = true;
    }
  }
  const extra = rows.filter(r => !EXPECTED_PLANS.some(p => p.code === r.code));
  if (extra.length > 0) {
    console.log(`  ! 表中存在额外套餐（不影响上线，留意是否下架）：${extra.map(r => r.code).join(', ')}`);
  }

  // ── 4. dashboard 手动步骤提示 ──
  console.log('\n【4/4】Dashboard 手动步骤清单（凭据到达后执行，本脚本不联网）');
  console.log('  ① Products → 新建/核对 3 个 SKU（一次性商品，美元定价）：');
  console.log('     starter  「入门包」  $1.49   （product id 填 CREEM_PRODUCT_STARTER）');
  console.log('     standard 「主力包」  $4.99   （product id 填 CREEM_PRODUCT_STANDARD）');
  console.log('     pro      「重度包」  $13.99  （product id 填 CREEM_PRODUCT_PRO）');
  console.log('     → 价格必须与上表一致；测试环境与生产环境各有独立商品，需分别配置');
  console.log('  ② Developers → Webhook → 新建 webhook：');
  console.log('     URL：https://aifanyi.com/api/credits/webhook/creem');
  console.log('     事件：勾选 checkout.completed（refund.created 待退款处理代码就绪后再勾）');
  console.log('  ③ Developers → Webhook 页面复制 Webhook Secret → 填 CREEM_WEBHOOK_SECRET');
  console.log('  ④ .env 设置 PAYMENT_PROVIDER=creem 后重启（本地 npm run dev / 服务器 deploy.sh）');
  console.log('  ⑤ 完整上线流程见 docs/ready-checklist.md');

  console.log('\n════════════════════════════════════════════');
  if (fail) {
    console.log('结论：❌ 未就绪 —— 存在缺失/不一致项，请按上方提示处理后再上线');
    process.exit(1);
  } else {
    console.log('结论：✅ 本地检查全通过 —— 凭据齐全且三档一致，可进入 dashboard 比对与实测（见 ready-checklist.md）');
    process.exit(0);
  }
}

main()
  .catch((e) => {
    console.error('脚本执行失败：', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
