/**
 * 北京时间（UTC+8）日界统一工具
 * 背景：服务器时区可能是 UTC，setHours(0,0,0,0) / toISOString().slice(0,10) 的「今天」与用户视角的北京时间日界错位。
 * 所有按日统计/按日分组的代码统一走这里，保证日界 = 北京 0 点。
 */
export const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

/** 给定 Date，返回其北京时间日期键 YYYY-MM-DD（默认当前时间） */
export function beijingDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

/** 北京时间「今天」0 点的绝对时间戳 Date（服务器任意时区均正确） */
export function beijingDayStart(now: Date = new Date()): Date {
  const bj = new Date(now.getTime() + BEIJING_OFFSET_MS);
  bj.setUTCHours(0, 0, 0, 0);
  return new Date(bj.getTime() - BEIJING_OFFSET_MS);
}

/** 北京时间「本月」1 号 0 点 */
export function beijingMonthStart(now: Date = new Date()): Date {
  const bj = new Date(now.getTime() + BEIJING_OFFSET_MS);
  bj.setUTCDate(1);
  bj.setUTCHours(0, 0, 0, 0);
  return new Date(bj.getTime() - BEIJING_OFFSET_MS);
}
