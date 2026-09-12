import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';
import { GoogleTranslateProvider } from '@/lib/translator/providers/google';
import { GlmProvider } from '@/lib/translator/providers/glm';
import type { TranslateResult } from '@/lib/translator/types';
import { hashText, getCache, setCache } from '@/lib/translator/cache';
import {
  getAuthUserId,
  authErrorBody,
  beginSync,
  endSyncSuccess,
  endSyncFail,
  FEATURES,
} from '@/lib/credit/sync-settle';
import { estimateCredits } from '@/lib/credit/pricing';
import { isCreditDeductionEnabled } from '@/lib/credit/feature-flags';
import { checkGuestLimit } from '@/lib/guest-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/speak —— 「怎么说？」（V1.1 P1-1）
 * 输入：中文「想表达的意思」（2–200 字符），输出目标语言六块地道表达。
 * 选路：不走 translator 默认链（router.ts 非小语种只有 deepseek→glm，glm-4-flash 多语言弱），
 *       本路由直接实例化 Provider，自管 deepseek → google(降级直译) → glm 顺序与超时。
 * 缓存：内存缓存，键含 promptVersion='speak-v1'（prompt 迭代即失效旧缓存）。
 * 结算：sync-settle（登录必需；扣费总开关关闭时全流程空转，credit=0）。
 * 不写 TranslationJob 表：避免污染翻译成本/质量维度。
 */

const deepseek = new DeepSeekProvider();
const google = new GoogleTranslateProvider();
const glm = new GlmProvider();

const PROMPT_VERSION = 'speak-v1';
const MIN_BLOCKS = 3;
const BLOCK_MAX_CHARS = 600;
const DS_TIMEOUT_MS = 12000;
const GOOGLE_TIMEOUT_MS = 8000;
const GLM_TIMEOUT_MS = 12000;

const TARGET_LANGS = ['en', 'ja', 'ko', 'es'] as const;
type TargetLang = (typeof TARGET_LANGS)[number];

const LANG_NAMES: Record<TargetLang, string> = {
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
};

type BlockKey = 'natural' | 'casual' | 'formal' | 'native' | 'context' | 'example';

const BLOCK_KEYS: readonly (readonly [BlockKey, string])[] = [
  ['natural', '自然表达'],
  ['casual', '更口语'],
  ['formal', '更正式'],
  ['native', '更像当地人'],
  ['context', '使用场景'],
  ['example', '例句'],
];

function emptyBlocks(): Record<BlockKey, string> {
  return { natural: '', casual: '', formal: '', native: '', context: '', example: '' };
}

/** 去掉行首的 markdown / 序号 / 项目符号前缀与空白 */
function stripLead(line: string): string {
  return line
    .replace(/^[\s\-–—*•#>·、]+/, '')
    .replace(/^\d+\s*[.)、．]\s*/, '')
    .trim();
}

/** 命中「块名：内容」则返回键与内容；块名同时接受中文与英文（natural/自然表达…） */
function nameOf(stripped: string): { key: BlockKey; value: string } | null {
  const m = stripped.match(/^([^:：]{1,14})[:：]\s*([\s\S]*)$/);
  if (!m) return null;
  const label = m[1].trim();
  const lower = label.toLowerCase();
  for (const pair of BLOCK_KEYS) {
    if (lower === pair[0] || label === pair[1]) return { key: pair[0], value: m[2] };
  }
  return null;
}

/** 逐行解析六块；允许部分成功（example 允许跨行）；单块截断 600 字符 */
function parseBlocks(raw: string): Record<BlockKey, string> {
  const out = emptyBlocks();
  const lines = String(raw || '').split(/\r?\n/);
  let cur: BlockKey | null = null;
  for (const line of lines) {
    const stripped = stripLead(line);
    const hit = stripped ? nameOf(stripped) : null;
    if (hit) {
      cur = hit.key;
      out[cur] = hit.value.trim();
      continue;
    }
    if (cur && line.trim()) {
      out[cur] = out[cur] ? out[cur] + '\n' + line.trim() : line.trim();
    }
  }
  for (const pair of BLOCK_KEYS) {
    out[pair[0]] = out[pair[0]].slice(0, BLOCK_MAX_CHARS).trim();
  }
  return out;
}

function countNonEmpty(blocks: Record<BlockKey, string>): number {
  let n = 0;
  for (const pair of BLOCK_KEYS) if (blocks[pair[0]]) n++;
  return n;
}

function withTimeout(p: Promise<TranslateResult>, ms: number): Promise<TranslateResult | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

const INVALID_INPUT_MSG = '请用一句话描述你想表达的意思（200 字以内）。';
const MODEL_FAILED_MSG = '没能生成地道说法，请换个说法再试（本次不消耗额度）。';
const SERVER_ERROR_MSG = '服务器错误，请稍后再试。';

/**
 * GET /api/speak?text=...&targetLang=...
 * 提交前的「预计使用 X 额度」估值（服务端按 PricingRule 算价，前端永不算价）。
 * 说明：/api/credit/estimate 无 speak 分支且不属于本任务可改文件，故估值入口放在本路由。
 */
export async function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get('text') || '').trim();
  const raw = req.nextUrl.searchParams.get('targetLang') || 'en';
  const targetLang: TargetLang = (TARGET_LANGS as readonly string[]).includes(raw) ? (raw as TargetLang) : 'en';
  if (text.length < 2 || text.length > 200) {
    return NextResponse.json({ ok: false, code: 'invalid_input', error: INVALID_INPUT_MSG }, { status: 400 });
  }
  // __robust-get__ 估值读取容错：PricingRule 查询异常时回落默认值，避免 GET 直接 500 空响应
  let est = 10;
  try {
    est = (await estimateCredits(FEATURES.SPEAK, 1))?.credits ?? 10;
  } catch {
    est = 10;
  }
  return NextResponse.json({
    ok: true,
    targetLang,
    estimatedCredits: est,
    deductionEnabled: isCreditDeductionEnabled(),
  });
}

export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  const started = Date.now();
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const rawLang = typeof body?.targetLang === 'string' ? body.targetLang : 'en';
    const targetLang: TargetLang = (TARGET_LANGS as readonly string[]).includes(rawLang) ? (rawLang as TargetLang) : 'en';
    const scenario = typeof body?.scenario === 'string' ? body.scenario.slice(0, 32) : 'general';

    if (text.length < 2 || text.length > 200 || !(TARGET_LANGS as readonly string[]).includes(rawLang)) {
      return NextResponse.json({ ok: false, code: 'invalid_input', error: INVALID_INPUT_MSG }, { status: 400 });
    }

    const auth = await getAuthUserId();
    if (!auth) {
      const gl = await checkGuestLimit(req);
      if (!gl.ok) return NextResponse.json({ ok: false, code: gl.code, error: gl.error }, { status: 429 });
      return NextResponse.json(authErrorBody(), { status: 401 });
    }

    const est = (await estimateCredits(FEATURES.SPEAK, 1))?.credits ?? 10;
    const hash = hashText(text, 'zh', targetLang, 'speak', '', PROMPT_VERSION);

    const hit = getCache(hash);
    if (hit) {
      const cachedBlocks = parseBlocks(hit.result);
      return NextResponse.json({
        ok: true,
        query: text,
        targetLang,
        targetLangName: LANG_NAMES[targetLang],
        blocks: cachedBlocks,
        model: 'cache:' + hit.model,
        cached: true,
        degraded: false,
        estimatedCredits: est,
        credits: 0,
        latencyMs: Date.now() - started,
        deductionEnabled: isCreditDeductionEnabled(),
      });
    }

    const jobId = 'spk_' + crypto.randomUUID();
    const begin = await beginSync({ userId: auth.userId, jobId, feature: FEATURES.SPEAK, estimatedCredits: est });
    if (!begin.ok) {
      return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status: 402 });
    }
    creditCtx = { jobId, usageId: begin.usageId, estimated: begin.estimated, userId: auth.userId };

    // 注入隔离：用户输入只是「要表达的意思」而非指令
    const userMsg = `\n【用户想表达的意思】\n${text}\n【/用户想表达的意思】`;

    let blocks: Record<BlockKey, string> | null = null;
    let rawOut = '';
    let model = '';
    let degraded = false;
    let costUsd = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    // 主：DeepSeek（12s）
    const ds = await withTimeout(
      deepseek.translate({ text: userMsg, sourceLang: 'zh', targetLang, scenario: 'speak', maxTokens: 700 }),
      DS_TIMEOUT_MS
    );
    if (ds && !ds.error && ds.text) {
      const parsed = parseBlocks(ds.text);
      if (countNonEmpty(parsed) >= MIN_BLOCKS) {
        blocks = parsed;
        rawOut = ds.text;
        model = ds.model;
        costUsd = ds.costUsd;
        promptTokens = ds.promptTokens;
        completionTokens = ds.completionTokens;
      }
    }

    // 降级 1：Google（纯翻译引擎，无结构输出）→ 仅回填 natural，标 degraded
    if (!blocks) {
      const g = await withTimeout(
        google.translate({ text, sourceLang: 'zh', targetLang, scenario: 'speak' }),
        GOOGLE_TIMEOUT_MS
      );
      if (g && !g.error && g.text) {
        blocks = emptyBlocks();
        blocks.natural = g.text.slice(0, BLOCK_MAX_CHARS);
        model = g.model;
        degraded = true;
        costUsd = g.costUsd;
        promptTokens = g.promptTokens;
        completionTokens = g.completionTokens;
      }
    }

    // 降级 2：GLM（六块，质量下降）
    if (!blocks) {
      const gm = await withTimeout(
        glm.translate({ text: userMsg, sourceLang: 'zh', targetLang, scenario: 'speak', maxTokens: 700 }),
        GLM_TIMEOUT_MS
      );
      if (gm && !gm.error && gm.text) {
        const parsed = parseBlocks(gm.text);
        if (countNonEmpty(parsed) >= MIN_BLOCKS) {
          blocks = parsed;
          rawOut = gm.text;
          model = gm.model;
          costUsd = gm.costUsd;
          promptTokens = gm.promptTokens;
          completionTokens = gm.completionTokens;
        }
      }
    }

    // 全失败 / 有效块 <3 → 502 + 全额退额
    if (!blocks) {
      await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated });
      creditCtx = null;
      return NextResponse.json({ ok: false, code: 'model_failed', error: MODEL_FAILED_MSG }, { status: 502 });
    }

    const settled = await endSyncSuccess({
      userId: auth.userId,
      jobId,
      usageId: begin.usageId,
      estimated: begin.estimated,
      actualCredits: begin.estimated,
      costUsd,
      provider: model,
      model,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    });
    if (!settled.ok) {
      creditCtx = null;
      return NextResponse.json({ ok: false, code: 'server_error', error: SERVER_ERROR_MSG }, { status: 500 });
    }
    creditCtx = null;

    // 仅完整结果入缓存（降级直译不入缓存，避免后续把半成品当完整结果复用）
    if (!degraded && rawOut) setCache(hash, rawOut, model);

    return NextResponse.json({
      ok: true,
      query: text,
      targetLang,
      targetLangName: LANG_NAMES[targetLang],
      blocks,
      model,
      cached: false,
      degraded,
      estimatedCredits: begin.estimated,
      credits: settled.consumed,
      latencyMs: Date.now() - started,
      deductionEnabled: isCreditDeductionEnabled(),
      scenario,
    });
  } catch (e: unknown) {
    if (creditCtx) {
      await endSyncFail({
        userId: creditCtx.userId,
        jobId: creditCtx.jobId,
        usageId: creditCtx.usageId,
        estimated: creditCtx.estimated,
      }).catch(() => {});
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/speak]', msg);
    return NextResponse.json({ ok: false, code: 'server_error', error: SERVER_ERROR_MSG }, { status: 500 });
  }
}
