import { parsePdf } from '../../src/lib/pdf/parser';
import { PdfError } from '../../src/lib/pdf/types';
import * as fs from 'fs';

const cases = [
  ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/arxiv-dual-column.pdf', 'arxiv-dual'],
  ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-test/dummy.pdf', 'dummy(single)'],
  ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-test/multicol.pdf', 'multicol(3col)'],
  ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-test/corrupt.pdf', 'corrupt'],
  ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/images.pdf', 'images(scan)'],
  ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/encrypted.pdf', 'encrypted'],
];
(async () => {
  for (const [p, label] of cases) {
    if (!fs.existsSync(p)) { console.log('SKIP', label, '(missing)'); continue; }
    const buf = fs.readFileSync(p);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    try {
      const doc = await parsePdf(ab, label);
      const types: Record<string, number> = {};
      for (const pg of doc.pages) for (const b of pg.blocks) types[b.type] = (types[b.type] || 0) + 1;
      console.log(`OK ${label}: pages=${doc.pageCount} dual=${doc.limitations.length > 0} blocks=${JSON.stringify(types)}`);
    } catch (e: any) {
      if (e instanceof PdfError) console.log(`ERR ${label}: type=${e.errorType}`);
      else console.log(`ERR ${label}: ${e?.name}`);
    }
  }
})();