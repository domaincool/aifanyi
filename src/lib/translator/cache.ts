import { createHash } from 'crypto';

/**
 * 缓存与去重：
 * 1. 原文 SHA-256 哈希 → 命中直接返回历史结果（梗翻译 100% 走这里，零成本）
 * 2. 简单内存缓存 + 数据库兜底（TranslationJob 表）
 *
 * 注意：hash 必须包含语言与场景，否则 zh→ja 会错误命中 zh→en 的结果（2026-08-09 修复）
 */

const memCache = new Map<string, { result: string; model: string; ts: number }>();
const MEM_TTL_MS = 60 * 60 * 1000; // 内存缓存 1 小时

export function hashText(text: string, sourceLang = '', targetLang = '', scenario = ''): string {
  return createHash('sha256').update(`${text.trim()}|${sourceLang}|${targetLang}|${scenario}`).digest('hex');
}

export function getCache(hash: string): { result: string; model: string } | null {
  const hit = memCache.get(hash);
  if (hit && Date.now() - hit.ts < MEM_TTL_MS) return hit;
  if (hit) memCache.delete(hash);
  return null;
}

export function setCache(hash: string, result: string, model: string): void {
  // 简单 LRU：超过 5000 条时清掉最老的 20%
  if (memCache.size > 5000) {
    const keys = [...memCache.keys()];
    for (const k of keys.slice(0, Math.floor(keys.length * 0.2))) memCache.delete(k);
  }
  memCache.set(hash, { result, model, ts: Date.now() });
}