const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/arxiv-dual-column.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  let left = 0, right = 0, sample = [];
  for (const it of tc.items) {
    if (!it.str || it.str.trim().length < 5) continue;
    const x = it.transform[4] / viewport.width;
    if (x < 0.45) left++; else if (x > 0.5) right++;
    if (sample.length < 6) sample.push(it.str.slice(0, 20) + '@x=' + x.toFixed(2));
  }
  console.log('page1 width:', viewport.width, '| left:', left, 'right:', right);
  console.log('samples:', sample.join(' | '));
})();