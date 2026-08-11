import { parsePdf } from '../../src/lib/pdf/parser';
import { PdfError } from '../../src/lib/pdf/types';
import * as fs from 'fs';
import * as path from 'path';

const dir = path.join(__dirname, 'pdf-samples');
const files = ['encrypted.pdf', 'empty-protected.pdf', 'images.pdf', 'arxiv-dual-column.pdf'];
(async () => {
  for (const f of files) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) { console.log(f, '→ 缺失'); continue; }
    const buf = fs.readFileSync(p);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    try {
      const doc = await parsePdf(ab, f);
      const types: Record<string, number> = {};
      for (const pg of doc.pages) for (const b of pg.blocks) types[b.type] = (types[b.type] || 0) + 1;
      console.log(`✅ ${f}: ${doc.pageCount}页 sourceLang=${doc.sourceLang} 双栏=${doc.doubleColumn || false} 块类型=${JSON.stringify(types)}`);
    } catch (e: any) {
      if (e instanceof PdfError) console.log(`⛔ ${f}: errorType=${e.code} | ${e.message.slice(0, 50)}`);
      else console.log(`⛔ ${f}: 未知错误 ${e?.message?.slice(0, 80)}`);
    }
  }
})();