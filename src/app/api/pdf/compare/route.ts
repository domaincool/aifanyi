/**
 * POST /api/pdf/compare
 * 段落级多模型对比：DeepSeek（已有，缓存命中零成本）+ GLM + Google
 * 积分：20 段/日（clientKey 维度）
 * 返回 { blockId, translations: { deepseek, glm, google } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { GlmProvider } from '@/lib/translator/providers/glm';
import { GoogleTranslateProvider } from '@/lib/translator/providers/google';
import { PdfDocument } from '@/lib/pdf/types';
import { PDF_CONFIG } from '@/lib/pdf/config';
import { buildPdfGroupPrompt } from '@/lib/pdf/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

const glm = new GlmProvider();
const google = new GoogleTranslateProvider();

export async function POST(req: NextRequest) {
  try {
    const { taskId, blockId } = await req.json();
    if (!taskId || !blockId) {
      return NextResponse.json({ errorType: 'parse_failed', message: '参数不完整。' }, { status: 400 });
    }

    // 防滥用维度
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const clientKey = createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);

    const job = await prisma.pdfJob.findUnique({ where: { taskId } });
    if (!job || !job.document) {
      return NextResponse.json({ errorType: 'task_not_found', message: '任务不存在或已过期。' }, { status: 404 });
    }

    // 对比积分：今日该 clientKey 对比次数 < 20
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const agg = await prisma.pdfJob.aggregate({
      where: { clientKey, createdAt: { gte: todayStart } },
      _sum: { compareCount: true },
    });
    const usedToday = agg._sum.compareCount || 0;
    if (usedToday >= PDF_CONFIG.quota.dailyCompareSegments) {
      return NextResponse.json({ errorType: 'quota_exceeded', message: `今日多模型对比积分已用完（${PDF_CONFIG.quota.dailyCompareSegments} 段/日）。明天再来吧！` }, { status: 429 });
    }

    const doc = job.document as unknown as PdfDocument;
    let targetBlock: any = null;
    for (const page of doc.pages) {
      const b = page.blocks.find((blk) => blk.id === blockId);
      if (b) { targetBlock = b; break; }
    }
    if (!targetBlock) {
      return NextResponse.json({ errorType: 'parse_failed', message: '段落不存在。' }, { status: 404 });
    }

    // 已有 DeepSeek 译文（零成本复用）；GLM + Google 并行
    const deepseekText = targetBlock.translations?.deepseek?.text || '';
    const prompt = buildPdfGroupPrompt(doc.sourceLang, doc.targetLang);
    const input = `${prompt}\n\n[SEG 1] ${targetBlock.text}`;
    const [glmR, googleR] = await Promise.all([
      glm.translate({ text: input, sourceLang: doc.sourceLang, targetLang: doc.targetLang, scenario: 'pdf', maxTokens: 2048 }),
      google.translate({ text: targetBlock.text, sourceLang: doc.sourceLang, targetLang: doc.targetLang, scenario: 'pdf' }),
    ]);

    const glmText = (!glmR.error && glmR.text) ? stripSeg(glmR.text) : '';
    const googleText = (!googleR.error && googleR.text) ? googleR.text : '';

    // 写回 document + compareCount +1
    targetBlock.translations = {
      deepseek: targetBlock.translations?.deepseek || { text: '', model: 'deepseek' },
      glm: glmText ? { text: glmText, model: 'glm', promptTokens: glmR.promptTokens, completionTokens: glmR.completionTokens, costUsd: glmR.costUsd, latencyMs: glmR.latencyMs } : undefined,
      google: googleText ? { text: googleText, model: 'google', promptTokens: googleR.promptTokens, completionTokens: googleR.completionTokens, costUsd: googleR.costUsd, latencyMs: googleR.latencyMs } : undefined,
    };
    await prisma.pdfJob.update({ where: { taskId }, data: { document: doc as unknown as object, compareCount: { increment: 1 } } });

    return NextResponse.json({
      blockId,
      translations: {
        deepseek: deepseekText ? { text: deepseekText, model: 'deepseek' } : null,
        glm: glmText ? { text: glmText, model: 'glm' } : null,
        google: googleText ? { text: googleText, model: 'google' } : null,
      },
    });
  } catch (e: any) {
    console.error('[pdf/compare] error:', e?.message);
    return NextResponse.json({ errorType: 'translation_failed', message: '对比失败，请稍后重试。' }, { status: 500 });
  }
}

function stripSeg(text: string): string {
  return text.replace(/\[SEG\s+\d+\]/g, '').trim();
}
