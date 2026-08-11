/**
 * 通用内存滑动窗口限流器（进程内）
 * 维度：IP / email / 任意 key
 * 注意：单进程内存实现；多实例部署时需换 Redis（当前单 PM2 实例足够）
 */
const buckets = new Map<string, number[]>();

interface RateLimitOptions {
  windowMs: number;   // 窗口毫秒
  max: number;        // 窗口内最大次数
}

export function rateLimit(key: string, opts: RateLimitOptions): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < opts.windowMs);
  if (arr.length >= opts.max) {
    buckets.set(key, arr);
    const retryAfterMs = opts.windowMs - (now - arr[0]);
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, retryAfterMs: 0 };
}

/** 定期清理过期桶（防内存泄漏），每小时调用一次即可 */
export function cleanupRateLimitBuckets(): void {
  const now = Date.now();
  for (const [key, arr] of buckets) {
    const live = arr.filter(t => now - t < 3600_000);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}

/** 从请求头提取客户端 IP（信任反向代理） */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  return headers.get('x-real-ip') || 'unknown';
}

export function hashKey(parts: string[]): string {
  return require('crypto').createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}
