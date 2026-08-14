/**
 * PricingRule seed：初始定价（成本锚定草案，用户确认后生效）
 * 运行：npx tsx prisma/seed-pricing.ts（服务器）
 * 幂等：按 feature+version upsert
 */
import { prisma } from '../src/lib/db';

const RULES = [
  // 文本翻译：2 credits / 千字符
  { feature: 'text_translation', unit: 'per_1000_chars', creditRate: 2, minCharge: 1, maxCharge: null },
  // PDF：2 credits / 页（单文件封顶 200）
  { feature: 'pdf_translation', unit: 'per_page', creditRate: 2, minCharge: 1, maxCharge: 200 },
  // 图片：3 credits / 张
  { feature: 'image_translation', unit: 'per_image', creditRate: 3, minCharge: 1, maxCharge: null },
  // 字幕：1 credit / 分钟
  { feature: 'subtitle_translation', unit: 'per_minute', creditRate: 1, minCharge: 1, maxCharge: null },
  // 文档：2 credits / 千字符
  { feature: 'doc_translation', unit: 'per_1000_chars', creditRate: 2, minCharge: 1, maxCharge: null },
  // 网页：2 credits / 千字符
  { feature: 'web_translation', unit: 'per_1000_chars', creditRate: 2, minCharge: 1, maxCharge: null },
  // 润色：2 credits / 千字符
  { feature: 'polish', unit: 'per_1000_chars', creditRate: 2, minCharge: 1, maxCharge: null },
  // 盲测：0（获客功能，无定价规则 = 免费）
  // 语音识别：1 credit / 分钟（GLM-ASR 0.06 元/分）
  { feature: 'speech_to_text', unit: 'per_minute', creditRate: 1, minCharge: 1, maxCharge: null },
  // 语音合成：1 credit / 千字符（GLM-TTS 约 0.04 元档）
  { feature: 'text_to_speech', unit: 'per_1000_chars', creditRate: 1, minCharge: 1, maxCharge: null },
  // 跨境电商工作台（V1 seed，成本/计量锚定，非最终商业定价；配置化不硬编码）
  { feature: 'product_enrich', unit: 'per_1000_chars', creditRate: 3, minCharge: 1, maxCharge: null },
  { feature: 'listing_generation', unit: 'per_1000_chars', creditRate: 3, minCharge: 1, maxCharge: null },
  { feature: 'listing_rewrite', unit: 'per_1000_chars', creditRate: 2, minCharge: 1, maxCharge: null },
  { feature: 'listing_translation', unit: 'per_1000_chars', creditRate: 2, minCharge: 1, maxCharge: null },
  { feature: 'image_ocr', unit: 'per_image', creditRate: 1, minCharge: 1, maxCharge: null },
  { feature: 'customer_translation', unit: 'per_1000_chars', creditRate: 2, minCharge: 1, maxCharge: null },
  { feature: 'customer_reply', unit: 'per_1000_chars', creditRate: 3, minCharge: 1, maxCharge: null },
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
