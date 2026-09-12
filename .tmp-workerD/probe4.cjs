/**
 * 探测 4：speak/page.js 的数据形态 —— SPEAK_SCENARIOS 被切进共享 chunk 了吗？
 * 查 client chunk 与 server chunk 目录里的 speak/culture 数据。
 */
const fs = require('fs');
const path = require('path');

// 1) server app speak 页引用的 chunk
const nft = JSON.parse(fs.readFileSync('.next/server/app/speak/page.js.nft.json', 'utf8'));
const files = nft.files.filter((f) => f.includes('chunk'));
console.log('speak index nft chunks:', files.length);
// 在这些 chunk 里找「值机托运」
const nb2 = Buffer.from('值机托运', 'utf8').toString('hex');
const nb3 = Buffer.from('场景表达指南', 'utf8').toString('hex');
const nb4 = Buffer.from('语言背后的文化', 'utf8').toString('hex');
for (const f of files.slice(0, 40)) {
  const p = path.resolve('.next/server', f.replace(/^.*?\.next[\\/]/, '.next/'));
  if (!fs.existsSync(p)) continue;
  const hex = fs.readFileSync(p).toString('hex');
  const hits = [];
  if (hex.includes(nb2)) hits.push('值机托运');
  if (hex.includes(nb3)) hits.push('场景表达指南');
  if (hex.includes(nb4)) hits.push('语言背后的文化');
  if (hits.length) console.log('HIT', p, hits.join('+'));
}
console.log('--- detail chunk scan ---');
// 2) 详情页 chunk
const nft2 = JSON.parse(fs.readFileSync('.next/server/app/speak/[scenario]/page.js.nft.json', 'utf8'));
for (const f of nft2.files.filter((x) => x.includes('chunk')).slice(0, 40)) {
  const p = path.resolve('.next/server', f.replace(/^.*?\.next[\\/]/, '.next/'));
  if (!fs.existsSync(p)) continue;
  const hex = fs.readFileSync(p).toString('hex');
  const hits = [];
  if (hex.includes(nb2)) hits.push('值机托运');
  if (hex.includes(nb3)) hits.push('场景表达指南');
  if (hex.includes(nb4)) hits.push('语言背后的文化');
  if (hits.length) console.log('HIT', p, hits.join('+'));
}
console.log('scan done');
