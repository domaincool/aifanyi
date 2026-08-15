/**
 * PricePlan seed：3 个首期 SKU（V2.2 面额重标定版）
 * 运行：npx tsx prisma/seed-plans.ts（服务器）
 * 幂等：按 code upsert
 * 量加成梯度：0% → +10% → +20%
 */
import { prisma } from '../src/lib/db';

const PLANS = [
  {
    code: 'starter',
    name: '入门包',
    priceCents: 590, // ¥5.9
    totalCredits: 590, // 590 积分
    purchasedCredits: 590, // 本金（长期有效）
    bonusCredits: 0, // 赠送 0（平价）
    bonusTtlDays: 30,
    badge: null,
    description: '首次体验 · 平价补量',
    sortOrder: 1,
  },
  {
    code: 'standard',
    name: '主力包',
    priceCents: 2990, // ¥29.9
    totalCredits: 3290, // 3290 积分（2990 本金 + 300 赠送）
    purchasedCredits: 2990, // 本金（长期有效）
    bonusCredits: 300, // 赠送 +10%（30 天）
    bonusTtlDays: 30,
    badge: '热销',
    description: '多送 300 积分 · 轻度付费主力',
    sortOrder: 2,
  },
  {
    code: 'pro',
    name: '重度包',
    priceCents: 9900, // ¥99
    totalCredits: 11880, // 11880 积分（9900 本金 + 1980 赠送）
    purchasedCredits: 9900, // 本金（长期有效）
    bonusCredits: 1980, // 赠送 +20%（30 天）
    bonusTtlDays: 30,
    badge: '最划算',
    description: '多送 1980 积分 · 跨境/重度用户',
    sortOrder: 3,
  },
];

async function main() {
  let created = 0, updated = 0;
  for (const p of PLANS) {
    const exists = await prisma.pricePlan.findUnique({ where: { code: p.code } });
    if (exists) {
      await prisma.pricePlan.update({ where: { code: p.code }, data: p });
      updated++;
    } else {
      await prisma.pricePlan.create({ data: p });
      created++;
    }
  }
  console.log(`PricePlan seed 完成：新建 ${created} / 更新 ${updated}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
