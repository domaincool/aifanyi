import { TranslateProvider, TranslateRequest, TranslateResult, buildSystemPrompt } from '../types';

/**
 * DeepSeek Provider（主路由）
 * 官方价格约：输入 ¥2/百万 token（缓存命中 ¥0.5），输出 ¥8/百万 token
 * 这里以美元近似计量：输入 $0.28/M，输出 $1.1/M（按汇率 7.2 折算，可在 env 中覆盖）
 */
export class DeepSeekProvider implements TranslateProvider {
  readonly id = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly costPerMTokIn = 0.28;
  readonly costPerMTokOut = 1.1;

  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const started = Date.now();
    if (!this.apiKey) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, error: 'DEEPSEEK_API_KEY 未配置' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: buildSystemPrompt(req) },
            { role: 'user', content: req.text },
          ],
          temperature: 0.3,
          max_tokens: req.maxTokens ?? 2048,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `DeepSeek HTTP ${res.status}`);
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
