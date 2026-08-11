import { parsePdf } from '../../src/lib/pdf/parser';
import * as fs from 'fs';
(async () => {
  const p = 'G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/test-doc-single.pdf';
  const buf = fs.readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const doc = await parsePdf(ab, 'test-doc-single');
  const types: Record<string, number> = {};
  for (const pg of doc.pages) for (const b of pg.blocks) types[b.type] = (types[b.type] || 0) + 1;
  console.log(`OK test-doc(single): pages=${doc.pageCount} dual=${doc.limitations.length > 0} blocks=${JSON.stringify(types)}`);
})().catch(e => console.log('ERR:', e?.name, e?.message?.slice(0, 80)));