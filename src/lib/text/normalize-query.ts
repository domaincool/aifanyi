/**
 * 查询归一化（共享工具，V1.1 P1-7 意图数据闭环 + 2026-09-19 P1 检索规范化增强）
 *
 * 流程：去首尾空白 → 全角转半角 → 小写化 → 压缩连续空白 → 迭代剥离（尾部标点 → 疑问尾缀）×
 * 至稳定（最多 4 轮）→ 截断 64 字符。
 *
 * 2026-09-19 P1 增强（SearchQueryLog 证据：句式查询 30/30 zeroResult）：
 *   1. 尾缀表补全：是什么（裸）/ 什么梗（已有）/ 怎么用 / 组词 / 啥梗 / 什么鬼 等变体
 *   2. 迭代剥离：「yyds是什么意思」→ 剥「什么意思」→「yyds是什么」→ 再剥「是什么」→「yyds」
 *   3. 归一只影响匹配层；日志层（recordSearchQuery）继续记录原始输入
 *
 * 注意：剥离后长度 < 2 则回退原文（归一化后 base），避免剥成空串。
 */

/** 尾部标点（中英文问号/叹号/句号/逗号） */
const TRAIL_PUNCT = /[?？!！。，,.\s]+$/g;
/** 疑问尾缀（长前缀优先，含「用英语怎么说」类变体） */
const QUESTION_SUFFIX =
  /(是什么意思|啥意思|什么意思|是什么梗|什么梗|啥梗|是什么|怎么用|怎么念|怎么读|怎么说|怎么讲|怎么表达|如何表达|怎么翻译|组词|造句|用英语怎么说|用英文怎么说|英语怎么说|英文怎么说|英语怎么讲|英文怎么讲)$/g;

/** 全角 → 半角（ASCII 可见化 + 表意空格） */
function toHalfWidth(s: string): string {
  return s
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

/** 对称引号壳（弯引号/直引号/直角引号） */
const QUOTE_CHARS = ["“","”","‘","’","「","」","『","』","＂","\"","'"];

function stripQuoteWraps(s0: string): string {
  let out = s0.trim();
  for (let i = 0; i < 2; i++) {
    if (out.length < 3) break;
    const first = out[0];
    const last = out[out.length - 1];
    if (QUOTE_CHARS.includes(first) && QUOTE_CHARS.includes(last)) { out = out.slice(1, -1).trim(); } else break;
  }
  return out;
}

export function normalizeQuery(raw: string): string {
  const base = toHalfWidth(String(raw ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!base) return base;

  // 迭代剥离至稳定：「yyds是什么意思」→「yyds是什么」→「yyds」
  let cur = base.replace(TRAIL_PUNCT, '').replace(QUESTION_SUFFIX, '').replace(TRAIL_PUNCT, '').trim();
  for (let i = 0; i < 3; i++) {
    const next = cur.replace(TRAIL_PUNCT, '').replace(QUESTION_SUFFIX, '').replace(TRAIL_PUNCT, '').trim();
    if (next === cur) break;
    cur = next;
  }

  const unwrapped = stripQuoteWraps(cur);
  if (unwrapped !== cur && unwrapped.length >= 2) {
    let c2 = unwrapped.replace(TRAIL_PUNCT, '').replace(QUESTION_SUFFIX, '').replace(TRAIL_PUNCT, '').trim();
    for (let i = 0; i < 3; i++) {
      const next = c2.replace(TRAIL_PUNCT, '').replace(QUESTION_SUFFIX, '').replace(TRAIL_PUNCT, '').trim();
      if (next === c2) break;
      c2 = next;
    }
    if (c2.length >= 2) cur = c2;
  }
  const picked = cur.length >= 2 ? cur : base;
  return picked.slice(0, 64);
}

/**
 * 检索 token 化（P1 多词兜底）：把归一化 query 拆成可用于 LIKE 兜底的最小词元。
 * 拉丁词按空格拆（长度 ≥2）；整段 CJK 作为单一 token；去重保序，最多 4 个。
 * 例：'skibidi toilet' → ['skibidi', 'toilet']；'i need some space' → 停用词过滤后
 * ['need', 'some', 'space']（保留原语序，命中由 LIKE contains 决定）。
 */
const STOP_TOKENS = new Set(['is', 'are', 'the', 'a', 'an', 'of', 'to', 'do', 'does', 'what', 'how', 'in', 'on', 'it', 'its', 'is?', 'q']);

export function queryTokens(q: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const parts = String(q ?? '').split(/\s+/);
  for (const p of parts) {
    const t = p.replace(/[?？!！。，,.]/g, '').trim();
    if (t.length < 2 || seen.has(t)) continue;
    if (STOP_TOKENS.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 4) break;
  }
  return out;
}
