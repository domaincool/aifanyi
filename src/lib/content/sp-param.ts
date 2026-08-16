/**
 * searchParams 强类型归一：Next 15 对重复 query 键会合并为 string[]（?q=a&q=b → ['a','b']），
 * 未归一直接 .trim() 会抛 TypeError → 页面 500。所有聚合页参数读取必须经此函数。
 */
export function spStr(v: string | string[] | undefined, fallback = ''): string {
  const s = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
  return (s || fallback).trim();
}

/** 分页参数归一：非正整数 → 1 */
export function spPage(v: string | string[] | undefined): number {
  const s = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
  return Math.max(1, parseInt(s, 10) || 1);
}
