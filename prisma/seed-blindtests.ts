/**
 * 盲测擂台批量发题脚本
 * 运行：npx tsx prisma/seed-blindtests.ts（在项目根目录）
 * 每条题调 3 个模型（DeepSeek/GLM/Google）生成匿名译文，同步写入语料库
 *
 * 注意：tsx 独立运行不会自动加载 .env，这里手动解析后动态 require 模块
 */
import fs from 'fs';
import path from 'path';

// 1. 先加载 .env（必须在 require translator 之前）
const envFile = path.join(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"\r\n]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  console.log('已加载 .env');
} else {
  console.warn('警告：未找到 .env，模型 Key 可能为空');
}

// 2. 动态加载（env 就绪后再初始化 translator 单例）
const { translator } = require('../src/lib/translator/router');
const { prisma } = require('../src/lib/db');

const texts: { text: string; scenario: string }[] = [
  { text: '这个视频我看了三遍，笑死我了，真是YYDS级别的操作。', scenario: 'meme' },
  { text: '这款无线降噪耳机采用人体工学设计，佩戴轻盈舒适，续航长达30小时，是通勤路上的最佳伴侣。', scenario: 'ecommerce' },
  { text: '明天下午三点的会议改到线上进行，你把链接发群里就行。', scenario: 'general' },
  { text: '看到老照片的那一刻，我突然破防了，那些年的回忆一下子涌上来。', scenario: 'general' },
  { text: '感谢您对我们产品的关注，随信附上详细报价单，期待与您的进一步合作。', scenario: 'business' },
  { text: '有些路很远，走下去会很累，可是不走，会后悔。', scenario: 'literary' },
  { text: '使用前请确保设备已充满电，长按电源键三秒开机，红灯闪烁表示电量不足。', scenario: 'manual' },
  { text: '老板画的饼我已经吃饱了，现在只想躺平摸鱼，拒绝精神内耗。', scenario: 'meme' },
  { text: '这家店的牛肉面汤头浓郁，面条筋道，分量十足，性价比超高，强烈推荐！', scenario: 'review' },
  { text: '人工智能大模型正在重塑翻译行业，垂直领域的术语库成为新的竞争壁垒。', scenario: 'tech' },
  { text: '遇见你之后，我才知道原来喜欢一个人是这种感觉。', scenario: 'romantic' },
  { text: '非常抱歉给您带来不便，我们已为您安排加急补发，预计明天送达，感谢您的耐心等待。', scenario: 'customer-service' },
  { text: '亲，这款商品支持七天无理由退换，请您放心下单哦。', scenario: 'ecommerce' },
  { text: '他这套操作我只能说六个六，太秀了。', scenario: 'meme' },
  { text: '成年人的崩溃，往往就在一瞬间。', scenario: 'general' },
  { text: '这个需求很简单的，明天能上线吧？', scenario: 'workplace' },
  { text: '他家的螺蛳粉，臭是真臭，香也是真香。', scenario: 'review' },];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const item of texts) {
    // 去重：同原文已存在则跳过（脚本可重复运行）
    const dup = await prisma.blindtest.findFirst({ where: { sourceText: item.text } });
    if (dup) {
      console.log(`跳过（已存在）：${item.text.slice(0, 18)}...`);
      skipped++;
      continue;
    }
    const results: { model: string; text: string; error?: string }[] = await translator.translateAll(
      { text: item.text, sourceLang: 'zh', targetLang: 'en', scenario: 'general' },
      ['deepseek', 'glm', 'google']
    );
    if (results.length < 2) {
      console.log(`跳过：${item.text.slice(0, 18)}...（可用模型不足：${results.length}）`);
      skipped++;
      continue;
    }
    const shuffled = results
      .map((r) => ({ model: r.model, text: r.text }))
      .sort(() => Math.random() - 0.5)
      .map((r, i) => ({ anonymousId: String.fromCharCode(65 + i), model: r.model, text: r.text }));

    await prisma.blindtest.create({
      data: {
        sourceText: item.text,
        sourceLang: 'zh',
        targetLang: 'en',
        translations: shuffled as any,
      },
    });
    for (const s of shuffled) {
      await prisma.corpusEntry
        .create({
          data: {
            sourceText: item.text.slice(0, 2000),
            targetText: s.text.slice(0, 5000),
            sourceLang: 'zh',
            targetLang: 'en',
            scenario: 'blindtest',
            quality: 3,
          },
        })
        .catch(() => {});
    }
    created++;
    console.log(`已创建：${item.text.slice(0, 22)}...（${shuffled.map((s) => s.model).join(' / ')}）`);
  }
  const total = await prisma.blindtest.count();
  console.log(`发题完成：新建 ${created} 条 / 跳过 ${skipped} 条 / 当前盲测总数 ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
