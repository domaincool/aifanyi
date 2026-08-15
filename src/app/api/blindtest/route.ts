import { NextRequest, NextResponse } from 'next/server';
import { translator } from '@/lib/translator/router';
import { prisma } from '@/lib/db';

/**
 * POST /api/blindtest
 * 创建盲测：同一段原文调多个模型（匿名），存 JSONB 译文，返回盲测题。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceText, sourceLang = 'zh', targetLang = 'en' } = body;

    if (!sourceText || sourceText.trim().length === 0) {
      return NextResponse.json({ error: 'sourceText 不能为空' }, { status: 400 });
    }
    if (sourceText.length > 2000) {
      return NextResponse.json({ error: '盲测原文上限 2000 字符' }, { status: 400 });
    }

    // 匿名参与模型（缺 key 的会被 translateAll 跳过）
    const modelIds = ['deepseek', 'glm', 'google'];
    const results = await translator.translateAll({ text: sourceText, sourceLang, targetLang, scenario: 'general' }, modelIds);

    if (results.length < 2) {
      return NextResponse.json({ error: '可用模型不足（请检查 API Key 配置）' }, { status: 502 });
    }

    // 匿名化：A/B/C 顺序随机，不暴露模型名
    const shuffled = results
      .map((r, i) => ({ model: r.model, text: r.text }))
      .sort(() => Math.random() - 0.5)
      .map((r, i) => ({ anonymousId: String.fromCharCode(65 + i), model: r.model, text: r.text }));

    const blindtest = await prisma.blindtest.create({
      data: {
        sourceText,
        sourceLang,
        targetLang,
        translations: shuffled as any,
      },
    });

    // 每个译文也同步进语料库（盲测投票前的平行语料）
    for (const s of shuffled) {
      await prisma.corpusEntry.create({
        data: {
          sourceText: sourceText.slice(0, 2000),
          targetText: s.text.slice(0, 5000),
          sourceLang,
          targetLang,
          scenario: 'blindtest',
          quality: 3,
        },
      }).catch(() => {}); // 重复入库忽略
    }

    // 盲测 0 积分（获客），但写 UsageRecord 供统计
    await prisma.usageRecord.create({
      data: {
        feature: 'blindtest',
        inputCharacters: (sourceText || '').length,
        estimatedCredits: 0,
        reservedCredits: 0,
        consumedCredits: 0,
        status: 'consumed',
      },
    }).catch(() => {});

    return NextResponse.json({
      id: blindtest.id,
      sourceText: blindtest.sourceText,
      translations: shuffled.map((s) => ({ anonymousId: s.anonymousId, text: s.text })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}

/** GET /api/blindtest?limit=10 — 最近盲测列表（供首页/榜单） */
export async function GET(req: NextRequest) {
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') || 10));
  const list = await prisma.blindtest.findMany({
    where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, sourceText: true, sourceLang: true, targetLang: true, voteCount: true, winnerModel: true, createdAt: true },
  });
  return NextResponse.json({ list });
}
