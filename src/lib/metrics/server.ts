/**
 * 服务端内容埋点（流量增长 V1.0 Week1 D5）
 * - recordContentView：词条页渲染计数（pageview + touch 日志）
 * - 归因链（P5）：touch 日志记 contentSessionId 首末触点；signup/首翻事件由 API 侧回填
 * 设计取舍：V1 直接 upsert（量级 1107 词条 × 日频可接受），内存缓冲属后续优化
 */
import { prisma } from '@/lib/db';

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
