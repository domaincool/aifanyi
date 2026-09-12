/**
 * 探测 8：确认数据在哪、页面怎么引用它。
 * 1) speak 页面 nft.json 引用的全部文件里，找出包含 speak 数据 chunk 的（3050.js 归属）；
 * 2) culture 数据「语言背后的文化」同样定位；
 * 3) 列表页 /speak/${a.slug} 模板 + SPEAK_SCENARIOS 数据在同一 chunk ⇒ 渲染数据齐备。
 */
const fs = require('fs');
const path = require('path');

function readNft(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8')).files;
}

const checks = [
  { nft: '.next/server/app/speak/page.js.nft.json', needle: '值机托运' },
  { nft: '.next/server/app/speak/[scenario]/page.js.nft.json', needle: '值机托运' },
  { nft: '.next/server/app/culture/[slug]/page.js.nft.json', needle: '语言背后的文化' },
  { nft: '.next/server/app/culture/page.js.nft.json', needle: '语言背后的文化' },
];

for (const c of checks) {
  const nb = Buffer.from(c.needle, 'utf8').toString('hex');
  const files = readNft(c.nft);
  const hits = [];
  for (const f of files) {
    const abs = path.resolve('.next/server', f.replace(/^.*?\.next[\\/]server[\\/]?/, ''));
    const candidates = [f, abs, path.join('.next', f)];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        if (fs.readFileSync(p).toString('hex').includes(nb)) { hits.push(p); break; }
      }
    }
  }
  console.log(c.nft.replace('.next/server/app/', ''), '->', hits.length ? hits.join(' ; ') : 'NOT IN NFT GRAPH');
}
