import { readFileSync } from 'fs';
import { parsePdf } from '../../../src/lib/pdf/parser';
import { PdfError } from '../../../src/lib/pdf/types';
async function main() {
  for (const f of ['corrupt.pdf']) {
    const buf = readFileSync(`.openclaw/tmp/pdf-test/${f}`);
    try {
      await parsePdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), f);
      console.log(`${f}: 未抛错(异常)`);
    } catch (e: any) {
      if (e instanceof PdfError) console.log(`${f}: PdfError[${e.errorType}] ✓ ${e.message.slice(0, 40)}`);
      else console.log(`${f}: 其他 ${e?.message?.slice(0, 60)}`);
    }
  }
}
main();
