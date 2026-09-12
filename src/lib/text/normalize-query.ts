/**
 * 查询归一化（共享工具，V1.1 P1-7 意图数据闭环）
 *
 * 语义与 /understand/meaning 原实现（原 page.tsx normalizeQuery，2026-09-11 零结果词复盘）完全一致：
 *   去首尾空白 → 去尾部标点 → 去疑问后缀 → 再去尾部标点 → 截断 64 字符
 * 在此基础上额外补三步（对纯中文为恒等变换，故纯中文 query 结果与原实现一致）：
 *   1. 全角转半角（U+FF01–U+FF5E → U+0021–U+007E，表意空格 U+3000 → 半角空格）
 *   2. 小写化
 *   3. 压缩连续空白为单个空格
 *
 * 注意：原实现的「长度 < 2 则回落原文」分支保留；回落基准为归一化（半角/小写/压缩空白）后的 base。
 */

/** 尾标点（中英文问号/叹号/句号/逗号） */
const TRAIL_PUNCT = /[?？!！。，,.]+$/g;
/** 疑问后缀（与原实现逐字一致，含「什么意思/用英语怎么说」等变体） */
const QUESTION_SUFFIX = /(是什么意思|啥意思|什么意思|什么梗|啥梗|怎么说|怎么讲|怎么表达|如何表达|用英语怎么说|用英文怎么说|英语怎么说|英文怎么说)$/g;

/** 全角 → 半角（ASCII 可见区 + 表意空格） */
function toHalfWidth(s: string): string {
  return s
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

export function normalizeQuery(raw: string): string {
  const base = toHalfWidth(String(raw ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!base) return base;
  const stripped = base
    .replace(TRAIL_PUNCT, '')
    .replace(QUESTION_SUFFIX, '')
    .replace(TRAIL_PUNCT, '')
    .trim();
  const picked = stripped.length >= 2 ? stripped : base;
  return picked.slice(0, 64);
}
