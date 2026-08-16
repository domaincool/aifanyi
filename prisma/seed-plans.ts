/**
 * PricePlan seed：3 个美元 SKU（V1.2 最终版 · Creem 海外卡）
 * 运行：npx tsx prisma/seed-plans.ts（服务器）
 * 幂等：按 code upsert
 * 量加成梯度：0% → +10% → +20%（以「本金+赠送」拆分承担）
 * Source of Truth：$1.49→1000、$4.99→3600(3270+330)、$13.99→10000(8330+1670)
 */
import { prisma } from '../src/lib/db';

const PLANS = [
  {
    code: 'starter',
    name: '入门包',
    priceCents: 149, // $1.49
    totalCredits: 1000, // 1000 积分
    purchasedCredits: 1000, // 本金（长期有效）
    bonusCredits: 0, // 赠送 0（平价）
    bonusTtlDays: 30,
    badge: null,
    description: '首次体验 · 平价补量',
    sortOrder: 1,
  },
  {
    code: 'standard',
    name: '主力包',
    priceCents: 499, // $4.99
    totalCredits: 3600, // 3600 积分（3270 本金 + 330 赠送）
    purchasedCredits: 3270, // 本金（长期有效）
    bonusCredits: 330, // 赠送 +10%（30 天）
    bonusTtlDays: 30,
    badge: '热销',
    description: '多送 330 积分 · 轻度付费主力',
    sortOrder: 2,
  },
  {
    code: 'pro',
    name: '重度包',
    priceCents: 1399, // $13.99
    totalCredits: 10000, // 10000 积分（8330 本金 + 1670 赠送）
    purchasedCredits: 8330, // 本金（长期有效）
    bonusCredits: 1670, // 赠送 +20%（30 天）
    bonusTtlDays: 30,
    badge: '最划算',
    description: '多送 1670 积分 · 跨境/重度用户',
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
