/**
 * examples 归一化（P0-7）：把各批次历史形态统一折叠为 {zh, en} 对象数组。
 *
 * 背景：M2 批 8（首个大量走「新建」通道的批次）载荷用了 [zh, en] 数组对形态，
 * meme-import 两分支均为原样透传，35 条新建词条 examples 存成 [[zh,en],...]，
 * 前端读 e.zh 渲染为空（ops psql 已修存量，此 helper 保证两通道输出一致，防复发）。
 *
 * 支持形态：
 * - {zh, en} 对象 → 保留（缺侧补空串）
 * - [zh, en] 数组对 → 折叠为对象（约定先 zh 后 en，与批 8 载荷一致）
 * - null → 返回 null（显式清空语义，buildUpdateData 走 JsonNull）
 * - undefined → 返回 undefined（省略 = passthrough 保留旧值，不得变 [] 清空）
 * - 其他/乱形态 → 丢弃该条
 */
export interface NormalizedExample {
  zh: string;
  en: string;
}

export function normalizeExamples(raw: unknown): NormalizedExample[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return [];
  const out: NormalizedExample[] = [];
  for (const item of raw) {
    if (Array.isArray(item)) {
      const zh = typeof item[0] === 'string' ? item[0].trim() : '';
      const en = typeof item[1] === 'string' ? item[1].trim() : '';
      if (zh || en) out.push({ zh, en });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const zh = typeof o.zh === 'string' ? o.zh.trim() : '';
      const en = typeof o.en === 'string' ? o.en.trim() : '';
      if (zh || en) out.push({ zh, en });
    }
    // 字符串等其他形态丢弃（MemeEntry/PhraseEntry 例句模型必须双语）
  }
  return out;
}
