/**
 * POST /api/pdf/track
 * 埋点（匿名，不记录 PDF 内容）：13 类事件 fire-and-forget
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const ALLOWED = new Set([
  'pdf_upload', 'pdf_parse_success', 'pdf_parse_failed', 'translation_started', 'translation_completed',
  'translation_failed', 'model_compare_clicked', 'model_compare_completed', 'model_adopted',
  'docx_downloaded', 'bilingual_docx_downloaded', 'txt_downloaded', 'retry_clicked',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body.event || '');
    if (!ALLOWED.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await prisma.pdfEvent.create({
      data: {
        event,
        taskId: body.taskId ? String(body.taskId).slice(0, 64) : null,
        pageCount: typeof body.pageCount === 'number' ? body.pageCount : null,
        sourceLang: body.sourceLang ? String(body.sourceLang).slice(0, 10) : null,
        targetLang: body.targetLang ? String(body.targetLang).slice(0, 10) : null,
        durationMs: typeof body.durationMs === 'number' ? body.durationMs : null,
        costUsd: typeof body.costUsd === 'number' ? body.costUsd : null,
        model: body.model ? String(body.model).slice(0, 20) : null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[pdf/track] error:', e?.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
