import { TranslateProvider, TranslateRequest, TranslateResult } from '../types';

/**
 * OpenAI 兼容 Provider（预留：OpenAI / Claude / 其他国产模型）
 * 凡是 OpenAI Chat Completions 协议兼容的服务，都可以用这个适配器，
 * 通过 baseUrl 指向即可（如 deepseek 官方也兼容，但独立实现便于定制）。
 */
export class OpenAICompatProvider implements TranslateProvider {
  readonly id: string;
  readonly displayName: string;
  readonly costPerMTokIn: number;
  readonly costPerMTokOut: number;
  readonly model: string;

  private apiKey: string;
  private baseUrl: string;

  constructor(opts: {
    id: string;
    displayName: string;
    model: string;
    baseUrl: string;
    costPerMTokIn?: number;
    costPerMTokOut?: number;
  }) {
    this.id = opts.id;
    this.displayName = opts.displayName;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl;
    this.costPerMTokIn = opts.costPerMTokIn ?? 0;
    this.costPerMTokOut = opts.costPerMTokOut ?? 0;
    this.apiKey = process.env[`${opts.id.toUpperCase()}_API_KEY`] || '';
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const started = Date.now();
    if (!this.apiKey) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, error: `${this.id.toUpperCase()}_API_KEY 未配置` };
    }
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: `你是一位专业翻译。输出只有译文，不要解释。方向：${req.sourceLang} → ${req.targetLang}。${req.scenario === 'ecommerce' ? '跨境电商 Listing 本地化，地道、符合平台习惯。' : ''}` },
            { role: 'user', content: req.text },
          ],
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const costUsd = (usage.prompt_tokens / 1e6) * this.costPerMTokIn + (usage.completion_tokens / 1e6) * this.costPerMTokOut;
      return {
        model: this.id,
        text: (data.choices?.[0]?.message?.content || '').trim(),
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        costUsd,
        latencyMs: Date.now() - started,
      };
    } catch (e: any) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - started, error: e.message };
    }
  }
}
