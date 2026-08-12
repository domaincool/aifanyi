/**
 * 语音功能服务端限制（权威，前端只展示）
 * 每用户每分钟调用次数限制（内存滑动窗口，多实例部署时可用 Redis 升级）
 */
const buckets = new Map<string, number[]>();

export function checkRateLimit(userId: string, perMinute = 5): boolean {
  const now = Date.now();
  const arr = (buckets.get(userId) || []).filter((t) => now - t < 60_000);
  if (arr.length >= perMinute) {
    buckets.set(userId, arr);
    return false;
  }
  arr.push(now);
  buckets.set(userId, arr);
  return true;
}

export const VOICE_LIMITS = {
  maxBytes: 25 * 1024 * 1024, // 25MB（ASR 上限）
  maxSeconds: 30,             // 30s（ASR 上限）
  maxTextChars: 500,          // TTS 单次文本上限
} as const;
