const { parsePdf } = require('./out3/src/lib/pdf/parser.js');
const fs = require('fs');
(async () => {
  const p = 'G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/arxiv-dual-column.pdf';
  const buf = fs.readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const doc = await parsePdf(ab, 'arxiv-dual-column.pdf');
  const xs = [];
  for (const pg of doc.pages) for (const b of pg.blocks) {
    if (b.type !== 'header' && b.type !== 'footer' && b.text.length > 10) xs.push(+(b.bbox.x / pg.pageWidth).toFixed(3));
  }
  const left = xs.filter(x => x < 0.45).length;
  const right = xs.filter(x => x > 0.5).length;
  console.log('blocks:', xs.length, 'left(<0.45):', left, 'right(>0.5):', right);
  console.log('x 分布样本:', [...new Set(xs)].sort((a,b)=>a-b).slice(0, 12).join(','));
  console.log('limits:', JSON.stringify(doc.limitations));
})();