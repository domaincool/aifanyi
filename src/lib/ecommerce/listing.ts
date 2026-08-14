/**
 * 跨境电商工作台 · Listing 生成（完整 Draft 五块 + Fact Validation）
 * 输入：商品资料（enrich 后）+ 平台/市场/语言；输出：完整 Draft + 待确认项
 * 禁虚构：严格只基于商品资料撰写，无法确认的声明一律省略或进 warnings
 */
import { llmJson } from './llm-json';

export interface ListingDraft {
  title: string;
  bulletPoints: string[];
  description: string;
  keywords: string[];
  faqHighlights: string[];
}

export interface ListingGenerationOutput {
  draft: ListingDraft;
  warnings: string[];
}

export type ListingField = keyof ListingDraft;

function normalizeList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, max);
}

function productLines(p: {
  name: string;
  category?: string | null;
  brand?: string | null;
  features?: string[] | null;
  specifications?: string[] | null;
  materials?: string[] | null;
  targetMarket?: string | null;
  description?: string | null;
}): string {
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

const GEN_SYSTEM = [
  '你是一位资深的跨境电商 Listing 优化专家（Amazon/Shopify/独立站）。',
  '根据提供的商品资料，生成一份完整、可直接上架的 Listing 文案。',
  '必须只输出一个 JSON 对象（不要 markdown 围栏、不要额外文字）。',
  'JSON 结构：',
  '{',
  '  "title": "商品标题（简洁有力，含核心卖点与关键词，80 字符以内）",',
  '  "bulletPoints": ["5 条要点，每条突出一个卖点或使用场景，40 字以内"],',
  '  "description": "商品详情描述（分段，覆盖功能/场景/材质/规格，200-400 字）",',
  '  "keywords": ["8-12 个搜索关键词"],',
  '  "faqHighlights": ["3-5 条常见问答（买家常问 + 简短回答）"],',
  '  "warnings": ["需要卖家确认的声明（如具体认证、材质比例、尺寸是否准确等），无则空数组"]',
  '}',
  '严格只基于提供的商品资料撰写，禁止编造未提供的具体数字、认证、材质比例、质保时长、产地。',
  '任何无法从资料确认的声明，要么省略，要么放进 warnings。',
  '目标市场与平台会影响表达风格与单位（如美式/英式、公制/英制），请据此调整。',
].join('\n');

/** 生成完整 Listing Draft（含 Fact Validation warnings） */
export async function generateListing(input: {
  product: {
    name: string;
    category?: string | null;
    brand?: string | null;
    features?: string[] | null;
    specifications?: string[] | null;
    materials?: string[] | null;
    targetMarket?: string | null;
    description?: string | null;
  };
  platform: string;
  market: string;
  language: string;
}): Promise<ListingGenerationOutput> {
  const userContent = [
    `平台：${input.platform}`,
    `目标市场：${input.market}`,
    `输出语言：${input.language}`,
    productLines(input.product),
  ].join('\n');

  const r = await llmJson<any>({ systemPrompt: GEN_SYSTEM, userContent, temperature: 0.4, maxTokens: 4096 });
  if (!r.ok || !r.data) throw new Error(r.error || 'Listing 生成失败');

  const draft: ListingDraft = {
    title: String(r.data.title || '').trim().slice(0, 200),
    bulletPoints: normalizeList(r.data.bulletPoints, 8),
    description: String(r.data.description || '').trim().slice(0, 5000),
    keywords: normalizeList(r.data.keywords, 20),
    faqHighlights: normalizeList(r.data.faqHighlights, 8),
  };
  const warnings = normalizeList(r.data.warnings, 20);
  if (!draft.title && draft.bulletPoints.length === 0 && !draft.description) {
    throw new Error('Listing 生成结果为空');
  }
  return { draft, warnings };
}

const FIELD_INSTRUCTION: Record<ListingField, string> = {
  title: '重写商品标题（简洁有力，含核心卖点与关键词，80 字符以内），输出 value 为字符串',
  bulletPoints: '重写 5 条要点（每条突出一个卖点或场景，40 字以内），输出 value 为字符串数组',
  description: '重写商品详情描述（200-400 字，分段），输出 value 为字符串',
  keywords: '重写 8-12 个搜索关键词，输出 value 为字符串数组',
  faqHighlights: '重写 3-5 条常见问答要点，输出 value 为字符串数组',
};

/** 逐字段重生成（rewrite） */
export async function regenerateField(input: {
  field: ListingField;
  currentDraft: ListingDraft;
  product: {
    name: string;
    category?: string | null;
    brand?: string | null;
    features?: string[] | null;
    specifications?: string[] | null;
    materials?: string[] | null;
    targetMarket?: string | null;
    description?: string | null;
  };
  platform: string;
  market: string;
  language: string;
}): Promise<{ value: string | string[]; warnings: string[] }> {
  const cur = input.currentDraft[input.field];
  const curText = Array.isArray(cur) ? cur.join('\n') : String(cur || '');

  const system = [
    '你是跨境电商 Listing 优化专家。',
    '根据商品资料与现有 Listing，只重写用户指定的字段。',
    '必须只输出一个 JSON 对象（不要 markdown 围栏、不要额外文字）。',
    'JSON 结构：',
    '{',
    `  "value": <${input.field} 的新内容（string 或 string[]）>,`,
    '  "warnings": ["需要卖家确认的声明，无则空数组"]',
    '}',
    FIELD_INSTRUCTION[input.field],
    '严格只基于商品资料撰写，禁止编造未提供的具体数字、认证、材质比例。无法确认的声明省略或放进 warnings。',
  ].join('\n');

  const userContent = [
    `平台：${input.platform}`,
    `目标市场：${input.market}`,
    `输出语言：${input.language}`,
    `当前 ${input.field}：${curText || '（无）'}`,
    '现有完整 Listing（供上下文参考）：',
    `标题：${input.currentDraft.title}`,
    `要点：${input.currentDraft.bulletPoints.join(' / ')}`,
    `描述：${input.currentDraft.description}`,
    `关键词：${input.currentDraft.keywords.join('、')}`,
    `FAQ：${input.currentDraft.faqHighlights.join(' / ')}`,
    '商品资料：',
    productLines(input.product),
  ].join('\n');

  const r = await llmJson<any>({ systemPrompt: system, userContent, temperature: 0.4, maxTokens: 2048 });
  if (!r.ok || !r.data) throw new Error(r.error || '重生成失败');

  const isArrayField = input.field === 'bulletPoints' || input.field === 'keywords' || input.field === 'faqHighlights';
  const value = isArrayField ? normalizeList(r.data.value, 20) : String(r.data.value || '').trim();
  if (isArrayField ? (value as string[]).length === 0 : !value) {
    throw new Error('重生成结果为空');
  }
  return { value: value as string | string[], warnings: normalizeList(r.data.warnings, 20) };
}
