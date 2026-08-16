/**
 * PlatformRule + ContentCompliance seed（V1.2 P0-4）
 * 运行：npx tsx prisma/seed-platform-rules.ts（服务器）
 * 幂等：按唯一键 upsert
 *
 * 口径对齐（ai-edit 查询：where { platform, field, active }，platform 默认 'amazon'）：
 * - PlatformRule.platform 用 'amazon'（单值），market 记录 美/英/德/日 用中文（对齐产品 targetMarket 值）
 * - ContentCompliance.ruleType + ruleText Json { zh, en }
 */
import { prisma } from '../src/lib/db';

const PLATFORM_RULES = [
  // Amazon 美国站
  { platform: 'amazon', market: '美国', field: 'title', maxLength: 200, recommendedLength: 200, rules: { zh: '标题最多 200 字符', en: 'Title max 200 chars' } },
  { platform: 'amazon', market: '美国', field: 'bullet_points', maxLength: 500, recommendedLength: 1000, rules: { zh: '每条卖点最多 500 字符', en: 'Bullet max 500 chars each' } },
  { platform: 'amazon', market: '美国', field: 'description', maxLength: 2000, recommendedLength: 2000, rules: { zh: '描述建议 2000 字符内', en: 'Description within 2000 chars' } },
  { platform: 'amazon', market: '美国', field: 'keywords', maxLength: 250, recommendedLength: 250, rules: { zh: '关键词建议 250 字符内', en: 'Keywords within 250 chars' } },
  // Amazon 英国站
  { platform: 'amazon', market: '英国', field: 'title', maxLength: 200, recommendedLength: 200, rules: { zh: '标题最多 200 字符', en: 'Title max 200 chars' } },
  { platform: 'amazon', market: '英国', field: 'bullet_points', maxLength: 500, recommendedLength: 1000, rules: { zh: '每条卖点最多 500 字符', en: 'Bullet max 500 chars each' } },
  { platform: 'amazon', market: '英国', field: 'description', maxLength: 2000, recommendedLength: 2000, rules: { zh: '描述建议 2000 字符内', en: 'Description within 2000 chars' } },
  { platform: 'amazon', market: '英国', field: 'keywords', maxLength: 250, recommendedLength: 250, rules: { zh: '关键词建议 250 字符内', en: 'Keywords within 250 chars' } },
  // Amazon 德国站
  { platform: 'amazon', market: '德国', field: 'title', maxLength: 200, recommendedLength: 200, rules: { zh: '标题最多 200 字符', en: 'Title max 200 chars' } },
  { platform: 'amazon', market: '德国', field: 'bullet_points', maxLength: 500, recommendedLength: 1000, rules: { zh: '每条卖点最多 500 字符', en: 'Bullet max 500 chars each' } },
  { platform: 'amazon', market: '德国', field: 'description', maxLength: 2000, recommendedLength: 2000, rules: { zh: '描述建议 2000 字符内', en: 'Description within 2000 chars' } },
  { platform: 'amazon', market: '德国', field: 'keywords', maxLength: 250, recommendedLength: 250, rules: { zh: '关键词建议 250 字符内', en: 'Keywords within 250 chars' } },
  // Amazon 日本站
  { platform: 'amazon', market: '日本', field: 'title', maxLength: 200, recommendedLength: 200, rules: { zh: '标题最多 200 字符', en: 'Title max 200 chars' } },
  { platform: 'amazon', market: '日本', field: 'bullet_points', maxLength: 500, recommendedLength: 1000, rules: { zh: '每条卖点最多 500 字符', en: 'Bullet max 500 chars each' } },
  { platform: 'amazon', market: '日本', field: 'description', maxLength: 2000, recommendedLength: 2000, rules: { zh: '描述建议 2000 字符内', en: 'Description within 2000 chars' } },
  { platform: 'amazon', market: '日本', field: 'keywords', maxLength: 250, recommendedLength: 250, rules: { zh: '关键词建议 250 字符内', en: 'Keywords within 250 chars' } },
];

const COMPLIANCE_RULES = [
  { ruleType: 'no_fabrication', platform: 'amazon', ruleText: { zh: 'Listing 中不得虚构商品属性、材质、功能或资质认证，所有描述必须基于真实产品信息。', en: 'Listings must not fabricate product attributes, materials, features, or certifications. All claims must be based on real product information.' } },
  { ruleType: 'no_sensitive_claim', platform: 'amazon', ruleText: { zh: '不得使用医疗/保健类敏感宣称（如治疗、治愈、药效），除非有相应资质。', en: 'Do not use medical or health-related sensitive claims (e.g. treat, cure, medicinal effect) unless properly licensed.' } },
  { ruleType: 'no_unverified_efficacy', platform: 'amazon', ruleText: { zh: '不得宣称未经第三方验证的功效（如减肥、增肌、防脱），需提供检测报告支撑。', en: 'Do not claim unverified efficacy (e.g. weight loss, muscle gain, anti-hair-loss) without supporting test reports.' } },
  { ruleType: 'no_false_discount', platform: 'amazon', ruleText: { zh: '不得虚构划线价、原价或促销折扣，价格信息须真实可查。', en: 'Do not fabricate strike-through prices, original prices, or promotion discounts. Price info must be verifiable.' } },
  { ruleType: 'no_infringement', platform: 'amazon', ruleText: { zh: '不得在标题/描述中使用他人注册商标、品牌名或受保护的关键词。', en: 'Do not use others trademarks, brand names, or protected keywords in titles or descriptions.' } },
  { ruleType: 'no_exaggeration', platform: 'amazon', ruleText: { zh: '避免绝对化用语（如最好、第一、100% 有效），除非有充分证据。', en: 'Avoid absolute terms (e.g. best, #1, 100% effective) unless fully substantiated.' } },
  { ruleType: 'accurate_specs', platform: 'amazon', ruleText: { zh: '尺寸、容量、材质、产地等规格参数必须与实物一致。', en: 'Dimensions, capacity, materials, and origin must match the actual product.' } },
  { ruleType: 'no_restricted_items', platform: 'amazon', ruleText: { zh: '不得上架平台禁止或限制销售的品类（危险品、管制物品等）。', en: 'Do not list prohibited or restricted categories (hazardous goods, controlled items, etc.).' } },
];

async function main() {
  let pr = 0, cr = 0;
  for (const r of PLATFORM_RULES) {
    const exists = await prisma.ecommercePlatformRule.findFirst({ where: { platform: r.platform, market: r.market, field: r.field, version: 1 } });
    if (exists) {
      await prisma.ecommercePlatformRule.update({ where: { id: exists.id }, data: r });
    } else {
      await prisma.ecommercePlatformRule.create({ data: r });
    }
    pr++;
  }
  for (const r of COMPLIANCE_RULES) {
    const exists = await prisma.ecommerceContentCompliance.findFirst({ where: { ruleType: r.ruleType, platform: r.platform } });
    if (exists) {
      await prisma.ecommerceContentCompliance.update({ where: { id: exists.id }, data: r });
    } else {
      await prisma.ecommerceContentCompliance.create({ data: r });
    }
    cr++;
  }
  console.log(`PlatformRules seed：${pr} 条（upsert）；ContentCompliance seed：${cr} 条（upsert）`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
