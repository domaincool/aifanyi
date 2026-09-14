/**
 * 服务端内容埋点（流量增长 V1.0 Week1 D5）
 * - recordContentView：词条页渲染计数（pageview + touch 日志）
 * - 归因链（P5）：touch 日志记 contentSessionId 首末触点；signup/首翻事件由 API 侧回填
 * - recordLanguageIntent（V1.1 P1-7）：语言意图事件落库（LanguageIntent），供意图漏斗/内容机会扫描
 * 设计取舍：V1 直接 upsert（量级 1107 词条 × 日频可接受），内存缓冲属后续优化
 */
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { normalizeQuery } from '@/lib/text/normalize-query';

const today = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** 词条页渲染计数（服务端埋点：force-dynamic 页每请求执行一次） */
export async function recordContentView(contentType: string, contentId: string, contentSessionId?: string | null) {
  try {
    await prisma.contentMetrics.upsert({
      where: { contentType_contentId_date: { contentType, contentId, date: today() } },
      create: { contentType, contentId, date: today(), pageviews: 1 },
      update: { pageviews: { increment: 1 } },
    });
    if (contentSessionId) {
      await prisma.contentTouch.create({ data: { contentSessionId, contentType, contentId } });
    }
  } catch {
    // 埋点失败不影响页面渲染
  }
}

/** 客户端事件计数（tool_click / signup / first_translation / credit_consume） */
export async function recordContentEvent(
  event: 'tool_click' | 'signup' | 'first_translation' | 'credit_consume' | 'content_scroll' | 'content_copy' | 'content_share' | 'translation_start' | 'translation_complete',
  contentType: string,
  contentId: string
) {
  const field = {
    tool_click: 'toolClicks',
    signup: 'signups',
    first_translation: 'firstTranslations',
    credit_consume: 'creditConsumed',
    content_scroll: 'scrolls',
    content_copy: 'copies',
    content_share: 'shares',
    translation_start: 'translationStarts',
    translation_complete: 'translationCompletions',
  }[event];
  if (!field) return;
  try {
    await prisma.contentMetrics.upsert({
      where: { contentType_contentId_date: { contentType, contentId, date: today() } },
      create: { contentType, contentId, date: today(), [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  } catch {
    // 静默
  }
}

/** 站内搜索日志（P2 四字段） */
export async function recordSearchQuery(query: string, resultCount: number, aiAnswerUsed = false) {
  try {
    await prisma.searchQueryLog.create({
      data: { query: query.slice(0, 128), resultCount, zeroResult: resultCount === 0, aiAnswerUsed },
    });
  } catch {
    // 静默
  }
}

/** First/Last Touch 归因查询（signup/首翻时调用：取会话首末内容触点） */
export async function getTouchAttribution(contentSessionId: string) {
  try {
    const touches = await prisma.contentTouch.findMany({
      where: { contentSessionId },
      orderBy: { touchedAt: 'asc' },
    });
    if (!touches.length) return null;
    return {
      first: touches[0],
      last: touches[touches.length - 1],
      count: touches.length,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// V1.1 P1-7：语言意图事件落库
// ─────────────────────────────────────────────────────────────────────────────

/** 敏感内容识别：邮箱 / 手机号 / 连续 ≥8 位数字 / 密码类关键词 */
function isSensitiveQuery(q: string): boolean {
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(q)) return true; // 邮箱
  if (/\+?\d[\d\s()-]{6,}\d/.test(q)) return true; // 手机号 / 长号码（含分隔符）
  if (/\d{8,}/.test(q)) return true; // 连续 ≥8 位数字
  if (/(password|passwd|pwd|密码|验证码|身份证|银行卡)/i.test(q)) return true; // 凭据类关键词
  return false;
}

const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

const clamp = (v: string | null | undefined, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

/** 意图事件输入（签名冻结，勿改） */
export type LanguageIntentInput = {
  eventId?: string;
  query: string;
  intent: string;
  confidence?: number;
  source?: string;
  channel?: string | null;
  language?: string | null;
  targetLang?: string | null;
  entity?: string | null;
  scenario?: string | null;
  contentMatch?: 'none' | 'exact' | 'partial' | 'zero';
  contentId?: string | null;
  contentType?: string | null;
  toolUsed?: string | null;
  toolType?: string | null;
  sessionKey?: string | null;
  enteredAt?: Date;
};

/**
 * 记录一条语言意图事件（V1.1 P1-7）
 * - queryHash = sha256(原始 query)：脱敏后仍保留可统计的指纹（丢弃内容、保留计数）
 * - 敏感命中（邮箱/手机号/≥8 位数字/密码类）→ query / normalizedQuery 均写 '[redacted]'
 * - eventId 缺省时合成 `${queryHash}:${Date.now()}:${random}`，重复命中 P2002 静默跳过（幂等）
 * - 绝不抛出、不记 IP、不记 userId
 */
export async function recordLanguageIntent(input: LanguageIntentInput): Promise<void> {
  try {
    const raw = String(input.query ?? '');
    if (!raw) return;
    const queryHash = sha256Hex(raw);
    const redacted = isSensitiveQuery(raw);
    const query = redacted ? '[redacted]' : raw.slice(0, 200);
    const normalizedQuery = redacted ? '[redacted]' : normalizeQuery(raw);
    const eventId =
      (input.eventId && String(input.eventId).trim()) || `${queryHash}:${Date.now()}:${randomBytes(6).toString('hex')}`;
    const intent = String(input.intent || '').trim() || 'other';
    const confidence = typeof input.confidence === 'number' && Number.isFinite(input.confidence)
      ? Math.min(1, Math.max(0, input.confidence))
      : 0;
    const contentMatch = input.contentMatch ?? 'none';

    await prisma.languageIntent.create({
      data: {
        eventId,
        query,
        queryHash,
        normalizedQuery,
        intent,
        confidence,
        source: clamp(input.source, 32) ?? 'unknown',
        channel: clamp(input.channel, 64),
        language: clamp(input.language, 16),
        targetLang: clamp(input.targetLang, 16),
        entity: clamp(input.entity, 128),
        scenario: clamp(input.scenario, 32),
        contentMatch,
        contentId: clamp(input.contentId, 128),
        contentType: clamp(input.contentType, 32),
        toolUsed: clamp(input.toolUsed, 64),
        toolType: clamp(input.toolType, 32),
        sessionKey: clamp(input.sessionKey, 64),
        enteredAt: input.enteredAt ?? new Date(),
      },
    });

    // V1.1 修订版：聚合为内容机会候选（status 恒 candidate，失败静默，不影响主链路）
    await upsertContentOpportunity({ query: raw, normalizedQuery, intent, redacted, targetLang: input.targetLang ?? null });
  } catch (e) {
    // P2002：eventId 冲突（同一事件重复上报）→ 幂等跳过；其余错误一律静默，埋点绝不抛出
    const code = (e as { code?: string } | null)?.code;
    if (code === 'P2002') return;
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// V1.1 修订版：内容机会聚合（ContentOpportunity 接线）
// - 只有 meaning / hidden_meaning / speak 三类意图聚合成候选（translate 为自由句子，会产生噪声，不聚合）
// - candidateTerm = normalizedQuery（已剥「是什么意思 / 怎么说」等问句外壳）
// - status 恒为 candidate（schema 默认），绝不自动发布；是否建页由人工判断
// ─────────────────────────────────────────────────────────────────────────────

/** 单个机会的 variants 封顶（防止异常流量撑爆字段） */
const OPPORTUNITY_VARIANT_CAP = 20;

// ── covered 自动回写（Growth Validation 排期 B）─────────────────────────────
// 候选词若已有 published 词条（MemeEntry / ExpressionEntry term 大小写不敏感精确匹配），
// 落库时回写 covered / coverageKind / coveredBy，让机会池能区分「真缺口」与「已覆盖验证」。
// zh 词条与 en 词条都算覆盖（route 不同但内容已存在，不做 lang 过滤）。
// 优先级：meme > expression；ExpressionEntry 同词多 type 时按 popularity 降序取首个，
// type 映射：idiom→idiom、untranslatable→untranslatable、slang/food/expression→expression。
// 查询失败一律静默返回 null（covered 保持 false，不影响聚合主链路）。

type CoverageHit = { kind: 'meme' | 'expression' | 'idiom' | 'untranslatable'; slug: string };

async function findExistingCoverage(term: string): Promise<CoverageHit | null> {
  try {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return null;
    const meme = await prisma.memeEntry.findFirst({
      where: { term: { equals: normalized, mode: 'insensitive' }, status: 'published' },
      select: { slug: true },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
    });
    if (meme) return { kind: 'meme', slug: meme.slug };
    const expr = await prisma.expressionEntry.findFirst({
      where: { term: { equals: normalized, mode: 'insensitive' }, status: 'published' },
      select: { slug: true, type: true },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
    });
    if (expr) {
      const kind: CoverageHit['kind'] =
        expr.type === 'idiom' ? 'idiom' : expr.type === 'untranslatable' ? 'untranslatable' : 'expression';
      return { kind, slug: expr.slug };
    }
    return null;
  } catch {
    return null;
  }
}

export async function upsertContentOpportunity(input: {
  query: string;
  normalizedQuery: string;
  intent: string;
  redacted: boolean;
  targetLang?: string | null;
}): Promise<void> {
  try {
    if (input.redacted) return;
    if (!['meaning', 'hidden_meaning', 'speak'].includes(input.intent)) return;
    const term = String(input.normalizedQuery ?? '').trim();
    const raw = String(input.query ?? '').trim();
    if (!term || term === '[redacted]' || term.length < 2 || !raw) return;

    const now = new Date();
    const existing = await prisma.contentOpportunity.findUnique({
      where: { candidateTerm_intent: { candidateTerm: term, intent: input.intent } },
    });
    if (existing) {
      const variants = existing.variants.includes(raw)
        ? existing.variants
        : [...existing.variants, raw].slice(-OPPORTUNITY_VARIANT_CAP);
      // covered 回写：存量候选未覆盖时按事件补查（已覆盖则短路，省一次查询）
      let coverageData: { covered: boolean; coverageKind: string; coveredBy: string } | null = null;
      if (!existing.covered) {
        const coverage = await findExistingCoverage(term);
        if (coverage) coverageData = { covered: true, coverageKind: coverage.kind, coveredBy: coverage.slug };
      }
      await prisma.contentOpportunity.update({
        where: { id: existing.id },
        data: {
          hits: { increment: 1 },
          score: { increment: 1 },
          variants,
          lastSeenAt: now,
          ...(coverageData
            ? { covered: coverageData.covered, coverageKind: coverageData.coverageKind, coveredBy: coverageData.coveredBy }
            : {}),
        },
      });
    } else {
      const coverage = await findExistingCoverage(term);
      await prisma.contentOpportunity.create({
        data: {
          candidateTerm: term,
          intent: input.intent,
          variants: [raw],
          hits: 1,
          score: 1,
          status: 'candidate',
          firstSeenAt: now,
          lastSeenAt: now,
          ...(input.targetLang ? { targetLang: input.targetLang.slice(0, 16) } : {}),
          ...(coverage ? { covered: true, coverageKind: coverage.kind, coveredBy: coverage.slug } : {}),
        },
      });
    }
  } catch {
    // 聚合失败不影响意图主链路
  }
}
