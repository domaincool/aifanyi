/**
 * 跨境电商工作台 · Listing AI 微调（AI Edit / Minimal Edit）
 * 与「重写（rewrite）」严格区分：只执行用户明确要求的最小必要修改，不改产品事实。
 * 独立 Prompt（不复用 rewrite prompt）；结构化输出含 fact_conflicts / platform_issues。
 */
import { llmJson } from './llm-json';
import type { ListingDraft, ListingField } from './listing';

export type { ListingField };

export interface EditChange {
  type: string;
  description: string;
}

export interface EditResult {
  content: string | string[];
  changes: EditChange[];
  warnings: string[];
  factConflicts: string[];
  platformIssues: string[];
}

export interface EditProductFacts {
  name: string;
  category?: string | null;
  brand?: string | null;
  features?: string[] | null;
  specifications?: string[] | null;
  materials?: string[] | null;
  targetMarket?: string | null;
  description?: string | null;
}

export interface PlatformRuleLite {
  field: string;
  minLength?: number | null;
  maxLength?: number | null;
  recommendedLength?: number | null;
  rules?: unknown;
}

const FIELD_TYPE_HINT: Record<ListingField, string> = {
  title: '当前字段是标题（string，简短有力）',
  bulletPoints: '当前字段是要点列表（string[]，每条一个卖点）',
  description: '当前字段是详情描述（string，分段）',
  keywords: '当前字段是关键词列表（string[]）',
  faqHighlights: '当前字段是 FAQ 要点列表（string[]）',
};

/** ListingDraft 字段 → PlatformRule.field（下划线命名） */
const FIELD_TO_RULE: Record<ListingField, string | null> = {
  title: 'title',
  bulletPoints: 'bullet_points',
  description: 'description',
  keywords: 'keywords',
  faqHighlights: null,
};

function normalizeList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, max);
}

function productLines(p: EditProductFacts): string {
  return [
    `商品名称：${p.name || '未提供'}`,
    `类别：${p.category || '未提供'}`,
    `品牌：${p.brand || '未提供'}`,
    `卖点/特性：${Array.isArray(p.features) && p.features.length ? p.features.join('；') : '未提供'}`,
    `规格参数：${Array.isArray(p.specifications) && p.specifications.length ? p.specifications.join('；') : '未提供'}`,
    `材质：${Array.isArray(p.materials) && p.materials.length ? p.materials.join('；') : '未提供'}`,
    `建议目标市场：${p.targetMarket || '未提供'}`,
    `原始描述：${p.description || '未提供'}`,
  ].join('\n');
}

function buildEditSystem(field: ListingField): string {
  return [
    '你是一位跨境电商 Listing 编辑专家，负责「AI 微调」：对用户基本满意的现有文案做最小必要修改。',
    '核心原则（Minimal Edit）：',
    '1. 能不改的内容坚决不改；只执行用户明确提出的修改要求，用户没要求的内容尽量保持原文。',
    '2. 尽可能保留原结构、原句式、原核心卖点与表达。',
    '3. 不得改变产品事实：不得虚构规格、认证、性能、销量、品牌信息。',
    '4. 不得改变目标市场与目标语言。',
    '5. 这不是「重写」，禁止大幅改动或重新生成一版完全不同的文案。',
    '6. 用户要求与产品资料冲突时（如要求把 water-resistant 写成 waterproof），不执行该修改、保持原事实，并在 fact_conflicts 中说明冲突。',
    '7. 用户要求与平台规则冲突时（如超出字段长度限制），优先遵守平台规则，并在 platform_issues 中说明。',
    '8. 若当前内容已符合用户要求，content 返回原内容，changes 为空数组，warnings 说明无需修改。',
    '9. 只修改用户指定的当前字段，不得改动其他字段。',
    FIELD_TYPE_HINT[field],
    '必须只输出一个 JSON 对象（不要 markdown 围栏、不要额外文字）。JSON 结构：',
    '{',
    '  "content": <修改后的字段内容，类型与原字段一致（string 或 string[]）>,',
    '  "changes": [{"type": "modified", "description": "一句话说明改了什么"}],',
    '  "warnings": ["需要卖家留意的提示，无则空数组"],',
    '  "fact_conflicts": ["与产品资料冲突的项，无则空数组"],',
    '  "platform_issues": ["与平台规则冲突的项，无则空数组"]',
    '}',
  ].join('\n');
}

function truncateToMax(value: string | string[], maxLen: number): string | string[] {
  if (Array.isArray(value)) {
    const result: string[] = [];
    let used = 0;
    for (const item of value) {
      const remaining = maxLen - used;
      if (remaining <= 0) break;
      const sliced = item.slice(0, remaining);
      result.push(sliced);
      used += sliced.length;
    }
    return result;
  }
  return value.slice(0, maxLen);
}

function contentLength(value: string | string[]): number {
  return Array.isArray(value) ? value.join('').length : String(value).length;
}

/**
 * Listing 字段 AI 微调。
 * @returns 微调结果（content 已做平台长度后置校验；fact_conflicts/platform_issues 由 AI 输出 + 后置检查合并）
 */
export async function editField(input: {
  field: ListingField;
  instruction: string;
  currentDraft: ListingDraft;
  product: EditProductFacts;
  platform: string;
  market: string;
  language: string;
  platformRules: PlatformRuleLite[];
}): Promise<EditResult> {
  const cur = input.currentDraft[input.field];
  const curText = Array.isArray(cur) ? cur.join('\n') : String(cur || '');

  const userContent = [
    `平台：${input.platform}`,
    `目标市场：${input.market}`,
    `输出语言：${input.language}`,
    `当前字段：${input.field}`,
    `当前字段内容：${curText || '（无）'}`,
    `用户修改要求：${input.instruction}`,
    '现有完整 Listing（仅供上下文参考，你只允许修改当前字段）：',
    `标题：${input.currentDraft.title}`,
    `要点：${input.currentDraft.bulletPoints.join(' / ')}`,
    `描述：${input.currentDraft.description}`,
    `关键词：${input.currentDraft.keywords.join('、')}`,
    `FAQ：${input.currentDraft.faqHighlights.join(' / ')}`,
    '商品资料（Fact 依据，不得违背）：',
    productLines(input.product),
    '平台规则（必须遵守，如字段长度限制）：',
    input.platformRules.length ? JSON.stringify(input.platformRules) : '无',
  ].join('\n');

  const r = await llmJson<any>({ systemPrompt: buildEditSystem(input.field), userContent, temperature: 0.3, maxTokens: 2048 });
  if (!r.ok || !r.data) throw new Error(r.error || 'AI 微调失败');

  const isArrayField = input.field === 'bulletPoints' || input.field === 'keywords' || input.field === 'faqHighlights';
  let content: string | string[] = isArrayField
    ? normalizeList(r.data.content, 20)
    : String(r.data.content ?? '').trim();

  // 后置兜底：AI 返回空则回退原内容
  if (isArrayField ? (content as string[]).length === 0 : !content) {
    content = isArrayField ? (Array.isArray(cur) ? (cur as string[]) : []) : (typeof cur === 'string' ? cur : '');
  }

  const platformIssues = normalizeList(r.data.platform_issues, 20);

  // 平台规则后置校验：长度超限 → 硬截断 + 提示
  const ruleField = FIELD_TO_RULE[input.field];
  const rule = ruleField ? input.platformRules.find((x) => x.field === ruleField) : undefined;
  if (rule && rule.maxLength && contentLength(content) > rule.maxLength) {
    content = truncateToMax(content, rule.maxLength);
    platformIssues.push(`已按平台字段长度限制（${rule.maxLength} 字符）调整内容。`);
  }

  const changes: EditChange[] = (Array.isArray(r.data.changes) ? r.data.changes : [])
    .map((c: any) => ({
      type: typeof c === 'string' ? 'modified' : String(c?.type || 'modified'),
      description: typeof c === 'string' ? String(c) : String(c?.description || ''),
    }))
    .filter((c: EditChange) => c.description.length > 0)
    .slice(0, 20);

  return {
    content,
    changes,
    warnings: normalizeList(r.data.warnings, 20),
    factConflicts: normalizeList(r.data.fact_conflicts, 20),
    platformIssues,
  };
}
