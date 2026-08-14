/**
 * 跨境电商工作台 · 客户助手（Customer Assistant）
 * 翻译 + 意图 / AI 回复 / 语气重写，均走 llmJson 结构化输出
 */
import { llmJson } from './llm-json';

// ── 1. 翻译 + 意图识别 ─────────────────────────────
export interface TranslateResult {
  translation: string;
  intent: string;
}

const TRANSLATE_SYSTEM = [
  '你是跨境电商客服助手，帮卖家理解海外客户的消息。',
  '请完成两件事：1) 把客户消息翻译成中文；2) 识别客户意图。',
  '只输出一个 JSON 对象，不要输出任何解释或额外文字：',
  '{',
  '  "translation": "客户消息的准确中文翻译（保留数字、规格、品牌名）",',
  '  "intent": "意图分类，取其一：询问价格/物流咨询/退换货/产品咨询/投诉/其他"',
  '}',
].join('\n');

export async function translateCustomerMessage(input: {
  sourceText: string;
  sourceLang: string;
}): Promise<TranslateResult> {
  const userContent = `客户消息（${input.sourceLang === 'auto' ? '语言未知，请自行判断' : input.sourceLang}）：\n${input.sourceText}`;
  const r = await llmJson<TranslateResult>({ systemPrompt: TRANSLATE_SYSTEM, userContent, temperature: 0.1, maxTokens: 1024 });
  if (!r.ok || !r.data) throw new Error(r.error || '翻译失败');
  return r.data;
}

// ── 2. AI 回复建议 ─────────────────────────────────
export interface ReplyResult {
  reply: string;
  tone: string;
}

const LANG_NAMES: Record<string, string> = {
  en: '英语',
  ja: '日语',
  ko: '韩语',
  fr: '法语',
  de: '德语',
  es: '西班牙语',
};

function buildReplySystem(sourceLang: string): string {
  const langInstruction = sourceLang && sourceLang !== 'auto'
    ? '请用「' + (LANG_NAMES[sourceLang] || sourceLang) + '」回复客户（与客户消息语言一致）。'
    : '请根据客户消息原文判断其语言，并用该语言回复客户。';
  return [
    '你是跨境电商客服，帮卖家回复海外客户。',
    langInstruction,
    '基于商品资料与客户消息，生成一条自然友好、能直接发送给客户的客服回复。',
    '只输出一个 JSON 对象：',
    '{',
    '  "reply": "客服回复正文（用客户语言，自然友好、解决客户问题、基于商品真实资料不编造）",',
    '  "tone": "professional"',
    '}',
    '严格只基于商品资料回答；不确定的信息（具体物流时效/库存）礼貌说明可进一步确认，不要编造。',
  ].join('\n');
}

export async function generateReply(input: {
  productName: string;
  productDescription: string;
  sourceText: string;
  translation: string;
  intent: string;
  sourceLang: string;
}): Promise<ReplyResult> {
  const userContent = [
    `商品名称：${input.productName || '（未提供）'}`,
    `商品描述：${input.productDescription || '（未提供）'}`,
    `客户消息原文：${input.sourceText}`,
    `客户消息翻译：${input.translation || '（未翻译）'}`,
    `客户意图：${input.intent || '（未知）'}`,
  ].join('\n');
  const r = await llmJson<ReplyResult>({ systemPrompt: buildReplySystem(input.sourceLang), userContent, temperature: 0.4, maxTokens: 1024 });
  if (!r.ok || !r.data) throw new Error(r.error || '生成回复失败');
  return r.data;
}

// ── 3. 语气重写 ────────────────────────────────────
const RETONE_SYSTEM = [
  '你是跨境电商客服。',
  '把给定回复改写为指定语气，保持语言与信息不变（原回复是英文就仍用英文）。',
  '只输出一个 JSON 对象：',
  '{',
  '  "reply": "改写后的回复"',
  '}',
  '语气档：professional=专业正式 / friendly=亲切友好 / concise=简洁直接',
].join('\n');

export async function retoneReply(input: { reply: string; tone: string }): Promise<{ reply: string }> {
  const userContent = `当前回复：\n${input.reply}\n\n目标语气：${input.tone}`;
  const r = await llmJson<{ reply: string }>({ systemPrompt: RETONE_SYSTEM, userContent, temperature: 0.3, maxTokens: 1024 });
  if (!r.ok || !r.data) throw new Error(r.error || '语气重写失败');
  return r.data;
}
