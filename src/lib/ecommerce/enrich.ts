/**
 * 跨境电商工作台 · AI 商品资料提取（enrich）
 * 输入：商品名称 + 原始描述；输出：结构化字段（类别/品牌/卖点/规格/材质/目标市场/关键词/需确认项）
 */
import { llmJson } from './llm-json';
import { EnrichOutput } from './types';

const SYSTEM = [
  '你是一位跨境电商商品资料分析专家。',
  '根据用户提供的商品信息，提取并补全结构化资料。',
  '必须只输出一个 JSON 对象（不要输出任何解释、不要 markdown 围栏、不要额外文字）。',
  'JSON 结构（字段缺失时用 null 或空数组）：',
  '{',
  '  "category": "商品类别（中文，如 家居用品/户外装备/消费电子，无则 null）",',
  '  "brand": "品牌名（无则 null）",',
  '  "features": ["核心卖点/功能特性（3-8 条，中文）"],',
  '  "specifications": ["规格参数（材质/尺寸/容量/功率等，中文）"],',
  '  "materials": ["材质/成分（中文）"],',
  '  "targetMarket": "建议目标市场（如 美国/欧洲/东南亚，无则 null）",',
  '  "keywords": ["SEO 关键词（中文 5-10 个）"],',
  '  "sellingPoints": ["可突出的差异化卖点（中文 3-5 条）"],',
  '  "needConfirm": ["AI 不确定、需用户确认的信息点（如 是否纯棉/是否可机洗）"]',
  '}',
  '严格只基于用户提供的信息提取，不要编造未提供的事实；任何不确定的项都放进 needConfirm，不要猜。',
].join('\n');

export async function enrichProduct(input: { name: string; description?: string | null }): Promise<EnrichOutput> {
  const userContent = [
    `商品名称：${input.name || '（未提供）'}`,
    `商品描述：${input.description || '（未提供）'}`,
  ].join('\n');

  const r = await llmJson<EnrichOutput>({ systemPrompt: SYSTEM, userContent, temperature: 0.2, maxTokens: 2048 });
  if (!r.ok || !r.data) throw new Error(r.error || 'AI 提取失败');
  return r.data;
}
