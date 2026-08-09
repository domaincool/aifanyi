import { readFileSync } from 'fs';
import { parsePdf } from '../../../src/lib/pdf/parser';
import { PdfError } from '../../../src/lib/pdf/types';

async function main() {
  const files = ['dummy.pdf', 'multicol.pdf'];
  for (const f of files) {
    const buf = readFileSync(`.openclaw/tmp/pdf-test/${f}`);
    try {
      const doc = await parsePdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), f);
      const blockTypes: Record<string, number> = {};
      for (const p of doc.pages) for (const b of p.blocks) blockTypes[b.type] = (blockTypes[b.type] || 0) + 1;
      console.log(`\n=== ${f} ===`);
      console.log(`页数: ${doc.pageCount} | 字符: ${doc.totalCharacters} | 源语言: ${doc.sourceLang}`);
      console.log(`limitations: ${JSON.stringify(doc.limitations)}`);
      console.log(`块类型: ${JSON.stringify(blockTypes)}`);
      const p1 = doc.pages[0];
      console.log(`第1页前3块:`);
      for (const b of p1.blocks.slice(0, 3)) {
        console.log(`  [${b.type}] fontSize=${b.fontSize} "${b.text.slice(0, 60)}"`);
      }
    } catch (e: any) {
      if (e instanceof PdfError) console.log(`\n=== ${f} === PdfError[${e.errorType}]: ${e.message}`);
      else console.log(`\n=== ${f} === 其他错误: ${e?.message}`);
    }
  }
}
main();
