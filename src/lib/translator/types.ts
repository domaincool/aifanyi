/**
 * 翻译路由器 · 统一接口契约
 * 所有模型 Provider 必须实现 TranslateProvider 接口，
 * 业务代码只依赖此接口，换模型不改业务。
 */

export interface TranslateRequest {
  text: string;
  sourceLang: string; // zh / en / ja ...
  targetLang: string;
  scenario?: string;  // general / ecommerce / meme / subtitle ...
  style?: string;     // us-direct / eu-formal / casual ...
  glossary?: { termZh: string; termEn: string }[]; // 用户词库/术语库注入
  maxTokens?: number;
}

export interface TranslateResult {
  model: string;
  text: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;      // 本次调用美元成本（用于计量）
  latencyMs: number;
  cached?: boolean;   // 是否缓存命中（零成本）
  error?: string;
}

export interface TranslateProvider {
  readonly id: string;         // "deepseek" / "glm" / "deepl"
  readonly displayName: string;
  readonly costPerMTokIn: number;  // 美元 / 百万 token（输入）
  readonly costPerMTokOut: number; // 美元 / 百万 token（输出）
  translate(req: TranslateRequest): Promise<TranslateResult>;
}

/** 构造系统提示词：场景 + 风格 + 术语锁定 */
export function buildSystemPrompt(req: TranslateRequest): string {
  const parts: string[] = [
    '你是一位专业翻译，输出只有译文本身，不要解释、不要加引号。',
    `翻译方向：${req.sourceLang} → ${req.targetLang}。`,
  ];
  if (req.scenario === 'ecommerce') {
    parts.push('场景：跨境电商 Listing 本地化。需要地道、符合平台（亚马逊/虾皮/TikTok Shop）文案习惯，突出卖点，避免中式英语。');
  } else if (req.scenario === 'meme') {
    parts.push('场景：网络用语/梗翻译。优先找目标语言中功能对等的表达，而不是直译。');
  } else if (req.scenario === 'subtitle') {
    parts.push('场景：字幕翻译。保持口语化，单句长度适合屏幕阅读。');
  }
  if (req.style === 'us-direct') parts.push('风格：美式直白，短句，行动导向。');
  if (req.style === 'eu-formal') parts.push('风格：欧式严谨，正式书面语。');
  if (req.style === 'casual') parts.push('风格：轻松口语化。');
  if (req.glossary && req.glossary.length > 0) {
    const terms = req.glossary.map((g) => `${g.termZh} → ${g.termEn}`).join('；');
    parts.push(`术语强制锁定（必须遵守，不得意译）：${terms}。`);
  }
  return parts.join('\n');
}
