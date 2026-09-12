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
  } catch (e) {
    // P2002：eventId 冲突（同一事件重复上报）→ 幂等跳过；其余错误一律静默，埋点绝不抛出
    const code = (e as { code?: string } | null)?.code;
    if (code === 'P2002') return;
    return;
  }
}
