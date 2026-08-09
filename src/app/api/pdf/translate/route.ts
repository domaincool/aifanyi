/**
 * POST /api/pdf/translate
 * 上传 PDF → 限制校验（大小/页数/字符数）→ 解析（Document Model）→ 创建 PdfJob（queued）
 * 返回 { taskId, status: "queued", pageCount, totalBlocks, sourceLang }
 * 阶段 2 起：后台 worker 消费 queued job 执行翻译
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { parsePdf } from '@/lib/pdf/parser';
import { createPdfJob } from '@/lib/pdf/job';
import { PdfError } from '@/lib/pdf/types';
import { PDF_CONFIG } from '@/lib/pdf/config';

export const runtime = 'nodejs';
export const maxDuration = 120; // 解析上限（秒）

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ errorType: 'parse_failed', message: '未收到文件，请重新上传。' }, { status: 400 });
    }
    const pdfFile = file as File;
    const fileName = pdfFile.name || 'document.pdf';

    // 限制 1：文件大小（上传即校验）
    if (pdfFile.size > PDF_CONFIG.maxFileBytes) {
      return NextResponse.json(
        { errorType: 'oversize', message: `文件过大（${(pdfFile.size / 1024 / 1024).toFixed(1)}MB），单文件上限 ${PDF_CONFIG.maxFileBytes / 1024 / 1024}MB。请压缩或拆分后上传。` },
        { status: 413 }
      );
    }
    if (pdfFile.size === 0) {
      return NextResponse.json({ errorType: 'corrupt', message: '文件为空，无法解析。' }, { status: 400 });
    }

    const buffer = await pdfFile.arrayBuffer();
    const doc = await parsePdf(buffer, fileName); // 内部抛 PdfError：too_many_pages / too_many_characters / encrypted / corrupt / no_text_layer / parse_failed

    // 防滥用维度：IP + UA 哈希（不存原文隐私）
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const clientKey = require('crypto').createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);

    const taskId = `pdf_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
    const { status } = await createPdfJob({ taskId, fileName, fileSize: pdfFile.size, doc, clientKey });

    return NextResponse.json({
      taskId,
      status,
      pageCount: doc.pageCount,
      totalBlocks: doc.pages.reduce((s, p) => s + p.blocks.length, 0),
      totalCharacters: doc.totalCharacters,
      sourceLang: doc.sourceLang,
      targetLang: doc.targetLang,
      limitations: doc.limitations,
      // 阶段 1：解析完成即返回摘要；翻译阶段 2 起由后台执行
      parseDurationMs: Date.now(),
    });
  } catch (e: any) {
    if (e instanceof PdfError) {
      return NextResponse.json({ errorType: e.errorType, message: e.message }, { status: e.errorType === 'oversize' ? 413 : 422 });
    }
    console.error('[pdf/translate] unexpected:', e?.message || e);
    return NextResponse.json({ errorType: 'parse_failed', message: 'PDF 解析失败，请稍后重试或换一个文件。' }, { status: 500 });
  }
}
