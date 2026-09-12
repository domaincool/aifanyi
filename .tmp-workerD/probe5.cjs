/**
 * 探测 5：全 .next/server 扫描 —— 「值机托运」「语言背后的文化」到底在哪个文件里？
 */
const fs = require('fs');
const path = require('path');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const nb2 = Buffer.from('值机托运', 'utf8').toString('hex');
const nb4 = Buffer.from('语言背后的文化', 'utf8').toString('hex');

const files = walk('.next/server/app', []);
console.log('scanning', files.length, 'files...');
let hits2 = 0, hits4 = 0;
for (const f of files) {
  const st = fs.statSync(f);
  if (st.size > 3_000_000) continue;
  const hex = fs.readFileSync(f).toString('hex');
  if (hex.includes(nb2)) { console.log('值机托运 @', f); hits2++; }
  if (hex.includes(nb4)) { console.log('语言背后的文化 @', f); hits4++; }
}
console.log('done. hits:', hits2, hits4);
