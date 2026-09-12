/**
 * 探测 6（终极）：在源码 src 下做同样的字节查找 ——
 * 若源文件里都找不到这些字节，说明写入时编码就被转换了（PowerShell/复制链路），
 * 若源里有而产物没有，才真是构建树摇/分包问题。
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

const needles = {
  值机托运: Buffer.from('值机托运', 'utf8').toString('hex'),
  场景表达指南: Buffer.from('场景表达指南', 'utf8').toString('hex'),
  语言背后的文化: Buffer.from('语言背后的文化', 'utf8').toString('hex'),
  打工人: Buffer.from('打工人', 'utf8').toString('hex'),
};

for (const rel of ['src/lib/content/speak-scenarios.ts', 'src/lib/content/culture-articles.ts', 'src/app/speak/page.tsx', 'src/app/speak/[scenario]/page.tsx']) {
  const buf = fs.readFileSync(rel);
  const hex = buf.toString('hex');
  const res = Object.entries(needles).map(([k, h]) => k + '=' + (hex.includes(h) ? 'Y' : 'N')).join(' ');
  console.log(rel, res, 'len', buf.length);
  // 打印文件前几个字节的 hex 判断 BOM/编码
  if (rel.endsWith('speak-scenarios.ts')) {
    console.log('  head hex:', buf.slice(0, 24).toString('hex'));
    // 若不是合法 UTF-8 中文，尝试按 GBK 解（用 iconv 不可用，改判：查 utf8「打工人」在 meme-data.ts 中应有）
  }
}
// 对照组：老文件 meme-data.ts（git 里的正常 UTF-8 文件）
const ref = fs.readFileSync('prisma/meme-data.ts');
console.log('meme-data.ts 打工人=', ref.toString('hex').includes(needles.打工人) ? 'Y' : 'N');
console.log('speak-scenarios.ts 打工人=', fs.readFileSync('src/lib/content/speak-scenarios.ts').toString('hex').includes(needles.打工人) ? 'Y' : 'N');
