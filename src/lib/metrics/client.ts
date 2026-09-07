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

export function sendContentEvent(
  event: 'tool_click' | 'signup' | 'first_translation' | 'credit_consume',
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
