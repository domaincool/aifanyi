const fs = require('fs');
let s = fs.readFileSync('src/lib/content/speak-scenarios.ts', 'utf8');

const oldIface = `export interface SpeakEntry {
  term: string; // 中文词
  slug: string; // 站内词条路径（必须真实存在）
  meaning: string; // 一句话释义
  translation: string; // 地道英文表达
  example?: string; // 例句（英文）
  exampleZh?: string; // 例句中文
  tags?: string[]; // 关联标签
}`;
const newIface = `export interface SpeakEntry {
  // 词条型表达（link 到 /meme/[slug]）：slug + tags 同时存在才渲染为链接卡
  term: string; // 中文词
  slug?: string; // 站内词条路径（必须真实存在）
  meaning?: string; // 一句话释义
  translation?: string; // 地道英文表达
  example?: string; // 例句（英文）
  exampleZh?: string; // 例句中文
  tags?: string[]; // 关联标签
  // 短语型表达（静态句卡，纯展示）：native + zh
  native?: string; // 英文/当地语说法
  zh?: string; // 中文说法
  note?: string; // 用法提示
}`;
if (!s.includes(oldIface)) { console.error('IFACE MISS'); process.exit(1); }
s = s.replace(oldIface, newIface);
fs.writeFileSync('src/lib/content/speak-scenarios.ts', s);
console.log('iface relaxed, len', s.length);
