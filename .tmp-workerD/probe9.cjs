/**
 * 探测 9：nft 文件列表实际内容 + 3050.js 被谁引用。
 */
const fs = require('fs');
const path = require('path');

const nft = JSON.parse(fs.readFileSync('.next/server/app/speak/page.js.nft.json', 'utf8'));
console.log('nft files sample:');
nft.files.slice(0, 25).forEach((f) => console.log('  ', f));

// 3050.js 在 .next/server/chunks 下，检查它是否被其他页面共享
const chunkPath = '.next/server/chunks/3050.js';
console.log('3050.js size:', fs.statSync(chunkPath).size);
const hex = fs.readFileSync(chunkPath).toString('hex');
const probes = {
  值机托运: Buffer.from('值机托运', 'utf8').toString('hex'),
  语言背后的文化: Buffer.from('语言背后的文化', 'utf8').toString('hex'),
  打工人: Buffer.from('打工人', 'utf8').toString('hex'),
  ghosting: Buffer.from('ghosting', 'utf8').toString('hex'),
};
for (const [k, h] of Object.entries(probes)) {
  console.log('3050.js has', k, hex.includes(h) ? 'YES' : 'no');
}
// 3050.js 是否被 speak/culture 页面 chunk require（搜索 require id）
const pageChunk = fs.readFileSync('.next/server/app/speak/page.js', 'utf8');
const m = pageChunk.match(/chunks\/(\d+)\.js/g);
console.log('speak page chunk refs:', m ? m.join(',') : 'none (bundled via id)');
