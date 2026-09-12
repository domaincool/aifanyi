/**
 * 探测 7：确定「值机托运」在 speak-scenarios.ts 中的真实形态（UTF-8 直找 vs 控制台假象）。
 * 文件 hex 里 值机托运 = e580?e6... 直接查；同时查产物 chunk（含 .next/server/chunks 与 app 目录全部）。
 */
const fs = require('fs');
const path = require('path');

function walk(dir, out) {
  let o = out;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, o);
      else o.push(p);
    }
  } catch {}
  return o;
}

const srcBuf = fs.readFileSync('src/lib/content/speak-scenarios.ts');
const srcHex = srcBuf.toString('hex');
const nb2 = Buffer.from('值机托运', 'utf8').toString('hex');
console.log('src has 值机托运 utf8 bytes?', srcHex.includes(nb2) ? 'YES' : 'NO');
const i = srcBuf.toString('utf8').indexOf('值机托运');
console.log('src string idx:', i);
if (i >= 0) console.log('src ctx:', JSON.stringify(srcBuf.toString('utf8').slice(i - 20, i + 30)));

// 产物全扫（这次包括 chunks 目录 + .next/server 全部 <8MB 文件）
const files = walk('.next/server', []).filter((f) => fs.statSync(f).size < 8_000_000);
console.log('scanning', files.length, 'files under .next/server');
let hits = 0;
for (const f of files) {
  const hex = fs.readFileSync(f).toString('hex');
  if (hex.includes(nb2)) { console.log('值机托运 @', f); hits++; }
}
console.log('total hits:', hits);
