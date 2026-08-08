import { TranslateProvider, TranslateRequest, TranslateResult } from '../types';

/**
 * Google Cloud Translation Provider（取代 DeepL）
 * 免费额度 50 万字符/月；超出后按 $20/百万字符 计费。
 * 用于保底/精翻，以及盲测多模型对比。
 *
 * 语言代码映射：Google 需要 zh-CN 而非 zh；ja/en/de/es 直接透传
 */
const LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  de: 'de',
  es: 'es',
  fr: 'fr',
};

export class GoogleTranslateProvider implements TranslateProvider {
  readonly id = 'google';
  readonly displayName = 'Google 翻译';
  readonly costPerMTokIn = 0; // 按字符计费，免费额度内不计成本
  readonly costPerMTokOut = 0;

  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || '';
    this.baseUrl = process.env.GOOGLE_TRANSLATE_BASE_URL || 'https://translation.googleapis.com/language/translate/v2';
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const started = Date.now();
    if (!this.apiKey) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, error: 'GOOGLE_TRANSLATE_API_KEY 未配置' };
    }
    try {
      const source = LANG_MAP[req.sourceLang] || req.sourceLang;
      const target = LANG_MAP[req.targetLang] || req.targetLang;
      const res = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: req.text,
          source,
          target,
          format: 'text',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Google HTTP ${res.status}`);
      const text = data?.data?.translations?.[0]?.translatedText || '';
      const chars = req.text.length;
      return {
        model: this.id,
        text: text.trim(),
        promptTokens: chars,
        completionTokens: chars,
        costUsd: 0, // 免费额度内不计费；超量后按字符计，后续可细化
        latencyMs: Date.now() - started,
      };
    } catch (e: any) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - started, error: e.message };
    }
  }
}
