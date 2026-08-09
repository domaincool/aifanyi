/**
 * PDF 解析器（阶段 1 核心）
 * pdfjs-dist → 页/块级 Document Model（bbox/字号/结构分类/页眉页脚/双栏检测/扫描版检测）
 *
 * 已知限制（如实标注，写进 limitations）：
 * - 多栏 PDF 内容顺序可能与原文不同（不假装支持）
 * - 表格只标记"可能的表格区域"，不承诺二维结构
 * - fontWeight/color 为启发式推断
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import { PdfDocument, PdfPage, PdfBlock, PdfError, PdfBlockType } from './types';
import { PDF_CONFIG } from './config';

/** 文本语言粗判（P1 简化版，用于默认源语言） */
export function detectSourceLang(text: string): string {
  const sample = text.slice(0, 2000);
  const hasHangul = /[\uAC00-\uD7AF]/.test(sample);
  const hasKana = /[\u3040-\u30FF]/.test(sample);
  const hasCyrillic = /[\u0400-\u04FF]/.test(sample);
  const hasHan = /[\u4E00-\u9FFF]/.test(sample);
  if (hasHangul) return 'ko';
  if (hasKana) return 'ja';
  if (hasCyrillic) return 'ru';
  if (hasHan) return 'zh';
  return 'en'; // 拉丁文本默认英语（P1 简化）
}

interface RawLine {
  text: string;
  x: number; y: number; width: number; height: number;
  fontSize: number;
  fontName: string;
  items: number; // 行内 item 数（表格启发式用）
}

/** 解析 PDF 字节 → Document Model；异常抛 PdfError（12 类错误体系） */
export async function parsePdf(data: ArrayBuffer, fileName: string): Promise<PdfDocument> {
  const started = Date.now();
  let pdf: any;
  try {
    pdf = await getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  } catch (e: any) {
    console.error('[pdf-parse] getDocument error:', e?.name, e?.message?.slice(0, 200));
    if (e?.name === 'PasswordException') {
      throw new PdfError('encrypted', '该 PDF 已加密，需要密码才能打开。请先解除密码保护后再上传。');
    }
    throw new PdfError('corrupt', '文件损坏或不是有效的 PDF，无法解析。请检查文件后重试。');
  }

  if (pdf.numPages > PDF_CONFIG.maxPages) {
    throw new PdfError('too_many_pages', `该 PDF 共 ${pdf.numPages} 页，超过单文件 ${PDF_CONFIG.maxPages} 页的上限。请拆分后上传。`);
  }

  const pages: PdfPage[] = [];
  let totalCharacters = 0;
  let totalImages = 0;
  const limitations: string[] = [];

  // 先扫一遍收集所有行的字号（求正文基准字号）
  const allFontSizes: number[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    let page: any;
    try {
      page = await pdf.getPage(p);
    } catch {
      throw new PdfError('parse_failed', `第 ${p} 页解析失败，文件可能已损坏。`);
    }
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const content = await page.getTextContent();
    // 行聚类：按 y 归行
    const lines: RawLine[] = [];
    const byY = new Map<number, RawLine[]>();
    for (const item of content.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const scaleX = tx[0] || 1;
      const fontSize = Math.abs(scaleX) > 0.1 ? scaleX : 12;
      const topY = pageHeight - (tx[5] + (item.height || fontSize));
      const x = tx[4];
      const key = Math.round(topY / 2); // ±2 容差聚类
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key)!.push({ text: item.str, x, y: topY, width: item.width || 0, height: item.height || fontSize, fontSize, fontName: item.fontName || '', items: 1 });
    }
    // 按 y 排序，行内按 x 排序拼接
    const sortedYs = [...byY.keys()].sort((a, b) => a - b);
    for (const yKey of sortedYs) {
      const row = byY.get(yKey)!;
      row.sort((a, b) => a.x - b.x);
      const first = row[0];
      const last = row[row.length - 1];
      lines.push({
        text: row.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim(),
        x: first.x,
        y: first.y,
        width: last.x + last.width - first.x,
        height: Math.max(...row.map((r) => r.height)),
        fontSize: Math.max(...row.map((r) => r.fontSize)),
        fontName: first.fontName,
        items: row.length,
      });
      allFontSizes.push(lines[lines.length - 1].fontSize);
    }
    totalCharacters += lines.reduce((s, l) => s + l.text.length, 0);
    if (totalCharacters > PDF_CONFIG.maxCharacters) {
      throw new PdfError('too_many_characters', `该 PDF 文本量超过 ${(PDF_CONFIG.maxCharacters / 10000).toFixed(0)} 万字符的上限，请拆分后上传。`);
    }

    // 图片/扫描检测（仅当文本很少时检查 operator list）
    let pageHasImage = false;
    if (lines.reduce((s, l) => s + l.text.length, 0) < 50) {
      try {
        const ops = await page.getOperatorList();
        pageHasImage = ops.fnArray.some((fn: number) => fn >= 83 && fn <= 88); // paintImageXObject 系列
      } catch { /* 忽略 */ }
      if (pageHasImage) totalImages++;
    }

    // 块切分：行间垂直 gap > 1.3×行高 → 新块
    const blocks: PdfBlock[] = [];
    let order = 0;
    let curLines: RawLine[] = [];
    const flush = () => {
      if (!curLines.length) return;
      const text = curLines.map((l) => l.text).join('\n');
      const x = Math.min(...curLines.map((l) => l.x));
      const y = Math.min(...curLines.map((l) => l.y));
      const right = Math.max(...curLines.map((l) => l.x + l.width));
      const bottom = Math.max(...curLines.map((l) => l.y + l.height));
      const fontSize = Math.max(...curLines.map((l) => l.fontSize));
      const fontName = curLines[0].fontName;
      const fontWeight = /bold|black|heavy|demi|semibold/i.test(fontName) ? 'bold' : 'normal';

      let type: PdfBlockType = 'paragraph';
      const isTopHeader = y < pageHeight * 0.08 && text.length < 120;
      const isBottomFooter = y > pageHeight * 0.92 && text.length < 120;
      if (isTopHeader) type = 'header';
      else if (isBottomFooter) type = 'footer';
      else if (fontSize >= bodyBase * 1.2 && text.length < 80) type = 'heading';
      else if (/^\s*([•●◦▪■□●◆◇\-*]|\d+[\.\)、]|[a-zA-Z][\.\)])/.test(text)) type = 'list-item';
      else if (curLines.length >= 2 && curLines.every((l) => l.items >= 2 && l.text.length < 60)) type = 'table'; // 可能表格区域

      blocks.push({
        id: `${p}-${order}`,
        type,
        text,
        order: order++,
        translations: {},
        bbox: { x, y, width: right - x, height: bottom - y },
        fontSize: Math.round(fontSize * 100) / 100,
        fontFamily: fontName || '',
        fontWeight,
        color: '#000000',
      });
      curLines = [];
    };
    const bodyBase = mode(allFontSizes) || 12;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (curLines.length) {
        const prev = curLines[curLines.length - 1];
        const gap = l.y - (prev.y + prev.height);
        if (gap > Math.max(prev.height, 6) * 1.3) flush();
      }
      curLines.push(l);
    }
    flush();

    pages.push({ pageNumber: p, pageWidth, pageHeight, blocks });
  }

  // 双栏检测（粗）：非 header/footer 行 x 起点双峰
  const bodyXs: number[] = [];
  for (const page of pages) {
    for (const b of page.blocks) {
      if (b.type !== 'header' && b.type !== 'footer' && b.text.length > 10) bodyXs.push(b.bbox.x / page.pageWidth);
    }
  }
  if (bodyXs.length > 8) {
    const left = bodyXs.filter((x) => x < 0.45).length;
    const right = bodyXs.filter((x) => x > 0.5).length;
    if (left > bodyXs.length * 0.25 && right > bodyXs.length * 0.25 && Math.abs(left - right) < bodyXs.length * 0.3) {
      limitations.push('该 PDF 包含多栏布局，部分内容阅读顺序可能与原文不同。');
    }
  }

  // 扫描版：整篇无文本
  if (totalCharacters < 20 && totalImages > 0) {
    throw new PdfError('no_text_layer', '该 PDF 是扫描版（纯图片），没有可提取的文字层，当前版本暂不支持直接翻译。请使用带文字层的 PDF（OCR 版本即将推出）。');
  }
  if (totalCharacters < 20) {
    throw new PdfError('no_text_layer', '该 PDF 没有可提取的文字内容。');
  }

  const doc: PdfDocument = {
    documentId: `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    sourceLang: detectSourceLang(pages.map((p) => p.blocks.map((b) => b.text).join(' ')).join(' ')),
    targetLang: 'zh',
    pageCount: pdf.numPages,
    pages,
    limitations,
    totalCharacters,
    createdAt: Date.now(),
  };
  // 释放
  try { await pdf.destroy(); } catch { /* ignore */ }
  console.log(`[pdf-parse] ${fileName}: ${doc.pageCount}页 ${doc.totalCharacters}字符 ${doc.pages.reduce((s,p)=>s+p.blocks.length,0)}块 ${Date.now()-started}ms`);
  return doc;
}

function mode(arr: number[]): number {
  if (!arr.length) return 12;
  const m = new Map<number, number>();
  for (const n of arr) m.set(n, (m.get(n) || 0) + 1);
  let best = arr[0], bestN = 0;
  for (const [k, v] of m) if (v > bestN) { bestN = v; best = k; }
  return best;
}
