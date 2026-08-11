const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/arxiv-dual-column.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  let left = 0, right = 0, total = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!it.str || it.str.trim().length < 5) continue;
      const x = it.transform[4] / vp.width;
      total++;
      if (x < 0.45) left++; else if (x > 0.5) right++;
    }
  }
  console.log('全文 items:', total, 'left(<0.45):', left, 'right(>0.5):', right, 'right%:', (right/total*100).toFixed(1));
})();