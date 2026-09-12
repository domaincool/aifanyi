/**
 * 最终冒烟（v3）：修正查找范围 —— 页面级内容在 .next/server/app/<page>/page.js，
 * 数据级内容在 .next/server/chunks/*。两类都查。
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

const findIn = (dirs, needle) => {
  const nb = Buffer.from(needle, 'utf8').toString('hex');
  return dirs.some((d) => walk(d, []).some((f) => fs.readFileSync(f).toString('hex').includes(nb)));
};
const chunksDir = ['.next/server/chunks'];
const appDir = ['.next/server/app'];

// 1) 路由注册
const manifest = JSON.parse(fs.readFileSync('.next/app-path-routes-manifest.json', 'utf8'));
const found = Object.values(manifest).filter((v) => String(v).startsWith('/speak') || String(v).startsWith('/culture'));
ok('4 routes registered (' + found.join(', ') + ')', found.length === 4);

// 2) 页面 chunk 存在
for (const p of ['.next/server/app/speak/page.js', '.next/server/app/speak/[scenario]/page.js', '.next/server/app/culture/page.js', '.next/server/app/culture/[slug]/page.js']) {
  ok('chunk exists: ' + p, fs.existsSync(p));
}

// 3) 数据与页面内容（数据在 chunks / 页面文案在 page.js）
ok('speak data (值机托运) in build', findIn(chunksDir, '值机托运'));
ok('speak data (场景表达指南) in build', findIn(chunksDir, '场景表达指南'));
ok('speak data (职场) in build', findIn(chunksDir, '职场'));
ok('speak data (ghosting links) in build', findIn(chunksDir, 'ghosting'));
ok('culture data (语言背后的文化) in build', findIn(chunksDir, '语言背后的文化'));
ok('culture data (一句话定义 label) in build', findIn(appDir, '一句话定义'));
ok('culture data (高频误解 label) in build', findIn(appDir, '高频误解'));
ok('culture article body (再说吧) in build', findIn(chunksDir, '再说吧'));

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

console.log(pass ? 'SMOKE v3 ALL PASS' : 'SMOKE v3 FAILED');
process.exit(pass ? 0 : 1);
