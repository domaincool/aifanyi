/**
 * 构建产物冒烟验证（UTF-8 版）：不依赖 DB，直接对 speak/culture 页产物做内容级验证。
 * 注意：Windows 控制台输出 GBK 不影响文件读取判断；源文件为 UTF-8，needle 用 unicode 转义比对。
 */
const fs = require('fs');
const path = require('path');

const root = '.next/server/app';
const u = (s) => Buffer.from(s, 'utf8').toString('utf8'); // noop，保持源为 utf8 字面量

// 1) app-path-routes-manifest 中 speak/culture 全部注册
const manifest = JSON.parse(fs.readFileSync('.next/app-path-routes-manifest.json', 'utf8'));
const found = Object.values(manifest).filter((v) => String(v).startsWith('/speak') || String(v).startsWith('/culture'));
console.log('routes registered:', found.join(', '));
if (found.length !== 4) throw new Error('route registration mismatch: ' + found.length);

// 2) speak/culture 页 JS 产物包含关键内容串（UTF-8 字节级比对）
const checks = [
  { file: path.join(root, 'speak/[scenario]/page.js'), needles: ['场景表达指南', 'application/ld+json', '"Article"', '/meme/', '/arena', '/#translator'] },
  { file: path.join(root, 'culture/[slug]/page.js'), needles: ['语言背后的文化', 'application/ld+json', '"Article"', '一句话定义', '高频误解', '/tools/image-translator'] },
  { file: path.join(root, 'speak/page.js'), needles: ['场景表达指南', '/speak/travel'] },
  { file: path.join(root, 'culture/page.js'), needles: ['语言与文化', '/culture/'] },
];
let pass = true;
for (const c of checks) {
  const content = fs.readFileSync(c.file, 'utf8');
  const missing = c.needles.filter((n) => !content.includes(u(n)));
  if (missing.length) {
    console.error('MISSING in', c.file, '->', missing.map((m) => Buffer.from(m, 'utf8').toString('hex').slice(0, 40)).join(' | '));
    pass = false;
  } else {
    console.log('OK', c.file.replace(root, ''), '(' + c.needles.length + ' needles)');
  }
}

// 3) sitemap 产物包含 12 个新增 URL
const sm = fs.readFileSync(path.join(root, 'sitemap.xml.body'), 'utf8');
const want = [
  'https://aifanyi.com/speak',
  ...['travel', 'business', 'ecommerce', 'work', 'social', 'dating', 'study'].map((s) => `https://aifanyi.com/speak/${s}`),
  ...['why-so-many-chinese-internet-abbreviations', 'chinese-vs-western-terms-of-address', 'chinese-euphemism-guide'].map((s) => `https://aifanyi.com/culture/${s}`),
];
const missingUrls = want.filter((uu) => !sm.includes(uu));
if (missingUrls.length) {
  console.error('MISSING sitemap urls:', missingUrls);
  pass = false;
} else {
  console.log('sitemap urls OK (' + want.length + ')');
}
console.log(pass ? 'SMOKE ALL PASS' : 'SMOKE FAILED');
process.exit(pass ? 0 : 1);
