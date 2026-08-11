/**
 * 零依赖 ZIP 读取 + docx/pptx 文本提取
 * ZIP：EOCD → central directory → local header → inflateRawSync（deflate）/ 直接读（stored）
 */
import { inflateRawSync } from 'zlib';

interface ZipEntry {
  name: string;
  method: number; // 0=stored 8=deflate
  compressedSize: number;
  localOffset: number;
}

function parseZip(buf: Buffer): Map<string, Buffer> {
  // EOCD：末尾 22 字节起找签名 0x06054b50
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP 文件（未找到目录）。');

  const entryCount = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();
  let p = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf-8', p + 46, p + 46 + nameLen);
    entries.set(name, { name, method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const out = new Map<string, Buffer>();
  for (const e of entries.values()) {
    // local header
    const lh = e.localOffset;
    if (buf.readUInt32LE(lh) !== 0x04034b50) continue;
    const nameLen = buf.readUInt16LE(lh + 26);
    const extraLen = buf.readUInt16LE(lh + 28);
    const dataStart = lh + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + e.compressedSize);
    if (e.method === 0) out.set(e.name, Buffer.from(data));
    else if (e.method === 8) {
      try { out.set(e.name, inflateRawSync(data)); } catch { /* 跳过损坏条目 */ }
    }
  }
  return out;
}

export interface DocParagraph {
  kind: 'heading' | 'paragraph' | 'list' | 'table' | 'slide';
  text: string;
  source: string; // 段落来源标识（docx 段落 / pptx slide N）
}

/** 解析 docx/pptx，返回结构化段落 */
export function parseDocFile(buf: Buffer, fileName: string): { paragraphs: DocParagraph[]; format: 'docx' | 'pptx'; error?: string } {
  const lower = fileName.toLowerCase();
  const isPptx = lower.endsWith('.pptx') || lower.endsWith('.ppt');
  const isDocx = lower.endsWith('.docx') || lower.endsWith('.doc');
  if (!isDocx && !isPptx) return { paragraphs: [], format: 'docx', error: '仅支持 .docx / .pptx 文件。' };

  let files: Map<string, Buffer>;
  try {
    files = parseZip(buf);
  } catch (e: any) {
    return { paragraphs: [], format: isPptx ? 'pptx' : 'docx', error: '文件解析失败（不是有效的 Office 文档）。' };
  }

  const paragraphs: DocParagraph[] = [];
  if (isDocx) {
    const xml = files.get('word/document.xml');
    if (!xml) return { paragraphs: [], format: 'docx', error: '文档内容缺失（word/document.xml 未找到）。' };
    const text = xml.toString('utf-8');
    // 按 <w:p> 段落拆分，提取 <w:t>
    const paraRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let m: RegExpExecArray | null;
    while ((m = paraRe.exec(text)) !== null) {
      const inner = m[1];
      const texts: string[] = [];
      const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
      let tm: RegExpExecArray | null;
      while ((tm = tRe.exec(inner)) !== null) {
        const t = tm[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        if (t.trim()) texts.push(t);
      }
      const line = texts.join('').trim();
      if (line.length < 2) continue;
      const isHeading = /<w:pStyle\b[^>]*w:val="(Heading|标题)/.test(inner) || /<w:pStyle\b[^>]*w:val="[1-9]"/.test(inner);
      const isList = /<w:numPr\b/.test(inner);
      const isTable = /<w:tbl\b/.test(inner.slice(0, 200)) || /<w:tblPr\b/.test(inner);
      paragraphs.push({ kind: isHeading ? 'heading' : isList ? 'list' : isTable ? 'table' : 'paragraph', text: line, source: `段落 ${paragraphs.length + 1}` });
    }
    if (paragraphs.length === 0) return { paragraphs: [], format: 'docx', error: '文档中没有可提取的文字内容。' };
    return { paragraphs, format: 'docx' };
  }

  // pptx：遍历 slide XML
  const slideNames = [...files.keys()].filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
    const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
    return na - nb;
  });
  if (slideNames.length === 0) return { paragraphs: [], format: 'pptx', error: 'PPT 中没有找到幻灯片内容。' };
  for (const sn of slideNames) {
    const text = files.get(sn)!.toString('utf-8');
    const tRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    let tm: RegExpExecArray | null;
    const slideTexts: string[] = [];
    while ((tm = tRe.exec(text)) !== null) {
      const t = tm[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      if (t) slideTexts.push(t);
    }
    if (slideTexts.length) {
      paragraphs.push({ kind: 'slide', text: slideTexts.join(' | '), source: `第 ${slideNames.indexOf(sn) + 1} 页` });
    }
  }
  if (paragraphs.length === 0) return { paragraphs: [], format: 'pptx', error: 'PPT 中没有可提取的文字内容（可能全是图片）。' };
  return { paragraphs, format: 'pptx' };
}
