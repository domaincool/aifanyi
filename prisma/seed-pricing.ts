/**
 * PricingRule seed：定价规则（V2.2 面额重标定：消耗积分整体 ×10，锚点 1 积分 = ¥0.01）
 * 运行：npx tsx prisma/seed-pricing.ts（服务器）
 * 幂等：按 feature+version upsert
 * 注：ASR/TTS 在 V2.1 已从 1→2，本次 ×10 后为 20（= 原 2 × 10）
 */
import { prisma } from '../src/lib/db';

const RULES = [
  // 文本翻译：20 积分 / 千字符
  { feature: 'text_translation', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  // PDF：20 积分 / 页（单文件封顶 2000）
  { feature: 'pdf_translation', unit: 'per_page', creditRate: 20, minCharge: 10, maxCharge: 2000 },
  // 图片：30 积分 / 张
  { feature: 'image_translation', unit: 'per_image', creditRate: 30, minCharge: 10, maxCharge: null },
  // 字幕：10 积分 / 分钟
  { feature: 'subtitle_translation', unit: 'per_minute', creditRate: 10, minCharge: 10, maxCharge: null },
  // 文档：20 积分 / 千字符
  { feature: 'doc_translation', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  // 网页：20 积分 / 千字符
  { feature: 'web_translation', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  // 润色：20 积分 / 千字符
  { feature: 'polish', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  // 盲测：0（获客功能，无定价规则 = 免费）
  // 语音识别：20 积分 / 分钟（GLM-ASR 0.06 元/分，毛利 ≈70%）
  { feature: 'speech_to_text', unit: 'per_minute', creditRate: 20, minCharge: 10, maxCharge: null },
  // 语音合成：20 积分 / 千字符（GLM-TTS 约 0.04 元档，毛利 ≈80%）
  { feature: 'text_to_speech', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  // 跨境电商工作台（V1 seed，成本/计量锚定，非最终商业定价；配置化不硬编码）
  { feature: 'product_enrich', unit: 'per_1000_chars', creditRate: 30, minCharge: 10, maxCharge: null },
  { feature: 'listing_generation', unit: 'per_1000_chars', creditRate: 30, minCharge: 10, maxCharge: null },
  { feature: 'listing_rewrite', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  // AI 微调：最小必要修改（按当前字段内容 + 用户指令字符计量）
  { feature: 'listing_ai_edit', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  { feature: 'listing_translation', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  { feature: 'image_ocr', unit: 'per_image', creditRate: 10, minCharge: 10, maxCharge: null },
  { feature: 'customer_translation', unit: 'per_1000_chars', creditRate: 20, minCharge: 10, maxCharge: null },
  { feature: 'customer_reply', unit: 'per_1000_chars', creditRate: 30, minCharge: 10, maxCharge: null },
];

async function main() {
  let created = 0, updated = 0;
  for (const r of RULES) {
    const exists = await prisma.pricingRule.findUnique({
      where: { feature_version: { feature: r.feature, version: 1 } },
    });
    if (exists) {
      await prisma.pricingRule.update({
        where: { feature_version: { feature: r.feature, version: 1 } },
        data: { creditRate: r.creditRate, minCharge: r.minCharge, maxCharge: r.maxCharge, active: true },
      });
      updated++;
    } else {
      await prisma.pricingRule.create({ data: { ...r, version: 1, active: true } });
      created++;
    }
  }
  console.log(`PricingRule seed 完成：新建 ${created} / 更新 ${updated}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
