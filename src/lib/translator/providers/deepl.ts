import { TranslateProvider, TranslateRequest, TranslateResult } from '../types';

/**
 * DeepL Provider（保底/精翻）
 * 免费层 50 万字符/月。仅用于工作台精翻等高质量场景。
 * 注意：DeepL 是 REST API，非 chat completions，翻译后原样返回。
 */
export class DeepLProvider implements TranslateProvider {
  readonly id = 'deepl';
  readonly displayName = 'DeepL';
  readonly costPerMTokIn = 0; // 按字符计费，免费层内不计 token
  readonly costPerMTokOut = 0;

  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPL_API_KEY || '';
    this.baseUrl = process.env.DEEPL_BASE_URL || 'https://api-free.deepl.com/v2';
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const started = Date.now();
    if (!this.apiKey) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, error: 'DEEPL_API_KEY 未配置' };
    }
    try {
      const params = new URLSearchParams({
        text: req.text,
        target_lang: req.targetLang.toUpperCase(),
      });
      if (req.sourceLang && req.sourceLang !== 'auto') {
        params.set('source_lang', req.sourceLang.toUpperCase());
      }
      const res = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `DeepL HTTP ${res.status}`);
      const chars = req.text.length;
      return {
        model: this.id,
        text: (data.translations?.[0]?.text || '').trim(),
        promptTokens: chars,
        completionTokens: chars,
        costUsd: 0,
        latencyMs: Date.now() - started,
      };
    } catch (e: any) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - started, error: e.message };
    }
  }
}
