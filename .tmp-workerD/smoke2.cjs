/**
 * 最终冒烟（v2，正确版）：
 * SSG 页面在 Next 15 output 非 standalone 下产物形态 = page.js + 共享 chunk（数据在 chunk 中）。
 * 验证点：路由注册 ×4 + 页面 chunk 存在 + speak/culture 数据位于被引用 chunk + sitemap 12 URL。
 */
const fs = require('fs');
const path = require('path');

function walk(dir, out) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(p);
    }
  } catch {}
  return out;
}

let pass = true;
const ok = (name, cond) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name); if (!cond) pass = false; };

// 1) 路由注册
const manifest = JSON.parse(fs.readFileSync('.next/app-path-routes-manifest.json', 'utf8'));
const found = Object.values(manifest).filter((v) => String(v).startsWith('/speak') || String(v).startsWith('/culture'));
ok('4 routes registered (' + found.join(', ') + ')', found.length === 4);

// 2) 页面 chunk 存在
for (const p of ['.next/server/app/speak/page.js', '.next/server/app/speak/[scenario]/page.js', '.next/server/app/culture/page.js', '.next/server/app/culture/[slug]/page.js']) {
  ok('chunk exists: ' + p, fs.existsSync(p));
}

// 3) 数据进入构建产物（chunk 内 UTF-8 字节级查找）
const findInChunks = (needle) => {
  const nb = Buffer.from(needle, 'utf8').toString('hex');
  return walk('.next/server/chunks', []).some((f) => fs.readFileSync(f).toString('hex').includes(nb));
};
ok('speak data (值机托运) in build chunks', findInChunks('值机托运'));
ok('speak data (场景表达指南) in build chunks', findInChunks('场景表达指南'));
ok('speak data (职场 tag links) in build chunks', findInChunks('职场'));
ok('culture data (语言背后的文化) in build chunks', findInChunks('语言背后的文化'));
ok('culture data (一句话定义 label) in build chunks', findInChunks('一句话定义'));
ok('culture data (高频误解 label) in build chunks', findInChunks('高频误解'));

// 4) Article JSON-LD 与 CTA/内链出现在页面 chunk
const detail = fs.readFileSync('.next/server/app/speak/[scenario]/page.js', 'utf8') + fs.readFileSync('.next/server/app/culture/[slug]/page.js', 'utf8');
ok('Article JSON-LD in detail pages', detail.includes('"Article"') && detail.includes('application/ld+json'));
ok('/arena internal link in speak detail', detail.includes('/arena'));
ok('/#translator CTA anchor present', detail.includes('/#translator'));

// 5) sitemap 12 个新增 URL
const sm = fs.readFileSync('.next/server/app/sitemap.xml.body', 'utf8');
const want = [
  'https://aifanyi.com/speak',
  ...['travel', 'business', 'ecommerce', 'work', 'social', 'dating', 'study'].map((s) => `https://aifanyi.com/speak/${s}`),
  ...['why-so-many-chinese-internet-abbreviations', 'chinese-vs-western-terms-of-address', 'chinese-euphemism-guide'].map((s) => `https://aifanyi.com/culture/${s}`),
];
const missing = want.filter((u) => !sm.includes(u));
ok('sitemap 12 new urls (' + (want.length - missing.length) + '/12)', missing.length === 0);
if (missing.length) console.log('  missing:', missing);

console.log(pass ? 'SMOKE v2 ALL PASS' : 'SMOKE v2 FAILED');
process.exit(pass ? 0 : 1);
