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
  if (req.scenario === 'explain') {
    parts.push('场景：翻译讲解。输入为「原文\\n---\\n译文」两段。请用中文讲解这段译文：先判断语气（如 自然/口语/正式/幽默），再判断场景（如 社交媒体/商务沟通/学术论文），再说明本地化方向（如 美国英语/英式英语），最后用 1-2 句话说明关键翻译决策（比如哪些表达没有直译，而是转换成了目标语言文化中更地道的说法）。输出严格为四行，格式：「语气：xxx」换行「场景：xxx」换行「本地化：xxx」换行「为什么：xxx」，不要输出其他任何内容。');
  } else if (req.scenario === 'polish') {
    parts.push('场景：译文润色。保持原意与风格，修正生硬、不地道的表达，让译文更流畅自然、更像母语者所写。只输出润色后的译文，不要解释改动。');
  } else if (req.scenario === 'auto') {
    parts.push('场景：AI 自动判断。先识别原文所属场景与语体（商务/学术/口语/游戏/网络用语等），再按最贴合的风格翻译，不要机械直译。');
  } else if (req.scenario === 'business') {
    parts.push('场景：商务翻译。保持正式、专业、得体的商务语气，符合商务邮件/合同/报价/会议等沟通习惯，术语准确，避免口语化。');
  } else if (req.scenario === 'academic') {
    parts.push('场景：学术翻译。严谨准确，术语规范，句式正式书面，符合学术论文/摘要/报告的规范表达，避免口语化。');
  } else if (req.scenario === 'casual') {
    parts.push('场景：口语翻译。自然口语化，贴近日常对话，地道不生硬，像母语者在聊天。');
  } else if (req.scenario === 'gaming') {
    parts.push('场景：游戏翻译。符合游戏本地化习惯：台词简短有力，技能/道具名贴切有氛围感，保留网感与幽默。');
  } else if (req.scenario === 'ecommerce') {
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
