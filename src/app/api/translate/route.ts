import { NextRequest, NextResponse } from 'next/server';
import { translator } from '@/lib/translator/router';
import { prisma } from '@/lib/db';
import { hashText, getCache } from '@/lib/translator/cache';
import { getAuthUserId, beginSync, endSyncSuccess, endSyncFail, estimateByChars, FEATURES } from '@/lib/credit/sync-settle';
import { ingestCorpus } from '@/lib/corpus/ingest';
import { checkGuestLimit, recordGuestUsage } from '@/lib/guest-limit';

/**
 * POST /api/translate
 * 翻译路由器入口。支持场景与风格档；自动缓存去重；任务与成本落库。
 */
export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  try {
    const auth = await getAuthUserId(); // 游客降级：不结算，照常翻译
    const body = await req.json();
    const { text, sourceLang = 'zh', targetLang = 'en', scenario = 'general', style, glossary, polish } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text 不能为空' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: '单次翻译文本过长（上限 5000 字符）' }, { status: 400 });
    }

    // AI 润色模式：输入为已有译文，按原风格润色（复用路由器：缓存/预算/落库一致）
    const reqScenario = polish ? 'polish' : scenario;
    const reqSourceLang = polish ? targetLang : sourceLang;
    const feature = polish ? FEATURES.POLISH : FEATURES.TEXT;

    // 缓存预检：命中直接返回（不产生 AI 调用，不扣积分）
    const cacheKey = hashText(text, reqSourceLang, targetLang, reqScenario);
    const hit = getCache(cacheKey);
    if (hit) {
      return NextResponse.json({ text: hit.result, model: 'cache:' + hit.model, cached: true, costUsd: 0, latencyMs: 0 });
    }

    // 游客限流（审计 P0 修复）：缓存命中不限制（零成本）；登录用户走 Credit 系统
    if (!auth) {
      const gl = await checkGuestLimit(req);
      if (!gl.ok) {
        return NextResponse.json({ error: gl.error, code: gl.code, retryAfterMs: gl.retryAfterMs }, { status: 429 });
      }
    }

    // 登录用户：reserve（原子检查余额）；游客跳过
    if (auth) {
      const est = await estimateByChars(feature, text.length);
      const jobId = `txt_${crypto.randomUUID()}`;
      const begin = await beginSync({ userId: auth.userId, jobId, feature, estimatedCredits: est });
      if (!begin.ok) return NextResponse.json({ error: begin.error, code: begin.code }, { status: 402 });
      creditCtx = { jobId, usageId: begin.usageId, estimated: begin.estimated, userId: auth.userId };
    }

    const result = await translator.translate({ text, sourceLang: reqSourceLang, targetLang, scenario: reqScenario, style, glossary });

    if (result.error) {
      if (creditCtx) await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated });
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // 任务落库（成本计量 + 后续质量分析的数据源）
    await prisma.translationJob.create({
      data: {
        sourceHash: hashText(text, reqSourceLang, targetLang, reqScenario),
        sourceText: text.slice(0, 2000),
        sourceLang: reqSourceLang,
        targetLang,
        scenario: reqScenario,
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

    // 游客成功翻译：计次 + 计字符（DB 持久化，重启不绕过）
    if (!auth) await recordGuestUsage(req, text.length);

    // 质量尚可的译文进语料库（general 场景默认 3 分）
    if (!result.error && result.text) {
      await ingestCorpus({
        sourceText: text.slice(0, 2000),
        targetText: result.text.slice(0, 5000),
        sourceLang: reqSourceLang,
        targetLang,
        scenario: 'workbench',
        quality: 3,
      });
    }

    // 结算：登录用户按实际消耗（reserve 后内部缓存命中 → actual 0 全退）
    let credits: number | undefined;
    if (creditCtx) {
      const actual = result.cached ? 0 : creditCtx.estimated;
      const settled = await endSyncSuccess({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated, actualCredits: actual });
      if (!settled.ok) return NextResponse.json({ error: settled.error }, { status: 500 });
      credits = settled.consumed;
    }

    return NextResponse.json({
      text: result.text,
      model: result.model,
      cached: result.cached ?? false,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      credits,
    });
  } catch (e: any) {
    if (creditCtx) await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated }).catch(() => {});
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
