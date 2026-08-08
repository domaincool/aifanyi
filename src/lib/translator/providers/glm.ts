import { TranslateProvider, TranslateRequest, TranslateResult, buildSystemPrompt } from '../types';

/**
 * GLM Provider（备选/免费档）
 * GLM-4-Flash 有免费档，超预算时自动降级到这里。
 */
export class GlmProvider implements TranslateProvider {
  readonly id = 'glm';
  readonly displayName = 'GLM';
  readonly costPerMTokIn = 0.01;  // 近似免费/极低
  readonly costPerMTokOut = 0.01;

  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.GLM_API_KEY || '';
    this.baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const started = Date.now();
    if (!this.apiKey) {
      return { model: this.id, text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, error: 'GLM_API_KEY 未配置' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: 'glm-4-flash', // 免费档；质量要求高时可切 glm-4-air
          messages: [
            { role: 'system', content: buildSystemPrompt(req) },
            { role: 'user', content: req.text },
          ],
          temperature: 0.3,
          max_tokens: req.maxTokens ?? 2048,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `GLM HTTP ${res.status}`);
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
