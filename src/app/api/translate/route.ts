import { NextRequest, NextResponse } from 'next/server';
import { translator } from '@/lib/translator/router';
import { prisma } from '@/lib/db';
import { hashText } from '@/lib/translator/cache';
import { ingestCorpus } from '@/lib/corpus/ingest';

/**
 * POST /api/translate
 * 翻译路由器入口。支持场景与风格档；自动缓存去重；任务与成本落库。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sourceLang = 'zh', targetLang = 'en', scenario = 'general', style, glossary } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text 不能为空' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: '单次翻译文本过长（上限 5000 字符）' }, { status: 400 });
    }

    const result = await translator.translate({ text, sourceLang, targetLang, scenario, style, glossary });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // 任务落库（成本计量 + 后续质量分析的数据源）
    await prisma.translationJob.create({
      data: {
        sourceHash: hashText(text),
        sourceText: text.slice(0, 2000),
        sourceLang,
        targetLang,
        scenario,
        style,
        model: result.model.replace(/^cache:/, ''),
        resultText: result.text.slice(0, 5000),
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        cached: result.cached ?? false,
      },
    });

    // 质量尚可的译文进语料库（general 场景默认 3 分）
    if (!result.error && result.text) {
      await ingestCorpus({
        sourceText: text.slice(0, 2000),
        targetText: result.text.slice(0, 5000),
        sourceLang,
        targetLang,
        scenario: 'workbench',
        quality: 3,
      });
    }

    return NextResponse.json({
      text: result.text,
      model: result.model,
      cached: result.cached ?? false,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
