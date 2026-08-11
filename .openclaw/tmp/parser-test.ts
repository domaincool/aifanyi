import { parsePdf } from '../../src/lib/pdf/parser';
import { PdfError } from '../../src/lib/pdf/types';
import * as fs from 'fs';

const dir = 'G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples';
const files = ['encrypted.pdf', 'empty-protected.pdf', 'images.pdf', 'arxiv-dual-column.pdf'];
(async () => {
  for (const f of files) {
    const p = dir + '/' + f;
    if (!fs.existsSync(p)) { console.log(f, '-> missing'); continue; }
    const buf = fs.readFileSync(p);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    try {
      const doc = await parsePdf(ab, f);
      const types: Record<string, number> = {};
      for (const pg of doc.pages) for (const b of pg.blocks) types[b.type] = (types[b.type] || 0) + 1;
      console.log(`OK ${f}: pages=${doc.pageCount} lang=${doc.sourceLang} limits=${JSON.stringify(doc.limitations)} blocks=${JSON.stringify(types)}`);
    } catch (e: any) {
      if (e instanceof PdfError) console.log(`ERR ${f}: errorType=${e.errorType} | ${e.message.slice(0, 40)}`);
      else console.log(`ERR ${f}: ${e?.name} ${e?.message?.slice(0, 60)}`);
    }
  }
})();