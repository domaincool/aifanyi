'use client';

/**
 * 客户端内容埋点 helper（流量增长 V1.0 Week1 D5）
 * - sendContentEvent：tool_click 等客户端事件上报 POST /api/metrics/content
 * - getContentSessionId：读写 aifanyi_cs 匿名会话 cookie（P5 归因载体，1 年有效）
 */
export function getContentSessionId(): string {
  if (typeof document === 'undefined') return '';
  const name = 'aifanyi_cs';
  let v = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  if (v) return v.split('=')[1];
  // 生成（crypto.randomUUID 优先，降级随机串）
  const id = (crypto as { randomUUID?: () => string } | undefined)?.randomUUID?.() || 'cs-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  document.cookie = name + '=' + id + '; path=/; max-age=31536000; SameSite=Lax';
  return id;
}

/**
 * 意图事件上报（V1.1 P1-1 收尾）：Ask AIFANYI 提交链路专用 ——
 * POST /api/metrics/intent（服务端 recordLanguageIntent 落 LanguageIntent + 聚合 ContentOpportunity）。
 * 设计约束与 sendContentEvent 一致：静默失败，绝不阻塞跳转主流程；服务端有 30 次/分 IP 限流。
 */
export function sendIntentEvent(input: {
  query: string;
  intent: string;
  confidence?: number;
  contentMatch?: 'none' | 'exact' | 'partial' | 'zero';
  contentId?: string | null;
  sessionKey?: string;
}) {
  try {
    const query = String(input.query || '').trim().slice(0, 200);
    if (!query) return;
    const body = JSON.stringify({
      query,
      intent: input.intent || 'other',
      ...(typeof input.confidence === 'number' ? { confidence: input.confidence } : {}),
      contentMatch: input.contentMatch || 'none',
      ...(input.contentId ? { contentId: input.contentId } : {}),
      ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
      source: 'ask',
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/intent', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/metrics/intent', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
  } catch {
    // 静默：埋点绝不影响主流程
  }
}

export function sendContentEvent(
  event:
    | 'tool_click'
    | 'signup'
    | 'first_translation'
    | 'credit_consume'
    | 'content_scroll'
    | 'content_copy'
    | 'content_share'
    | 'translation_start'
    | 'translation_complete',
  contentType: string,
  contentId: string
) {
  try {
    const body = JSON.stringify({ event, contentType, contentId, contentSessionId: getContentSessionId() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/content', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/metrics/content', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
  } catch {
    // 静默
  }
}
