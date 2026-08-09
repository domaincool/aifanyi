import { TranslateProvider, TranslateRequest, TranslateResult } from './types';
import { DeepSeekProvider } from './providers/deepseek';
import { GlmProvider } from './providers/glm';
import { GoogleTranslateProvider } from './providers/google';
import { OpenAICompatProvider } from './providers/openai';
import { hashText, getCache, setCache } from './cache';

/**
 * 翻译路由器：选路 + 缓存 + 预算降级 + 任务落库
 *
 * 选路策略（v0.2）：
 * - general / meme / subtitle → DeepSeek 主路由，失败降级 GLM
 * - ecommerce 精翻 → DeepSeek + 术语注入；失败降级 Google 翻译
 * - 预算超限 → 自动降级 GLM 免费档
 * - 缓存命中 → 零成本直接返回
 */
export class TranslatorRouter {
  private providers: Map<string, TranslateProvider> = new Map();
  private monthCostUsd = 0;
  private monthlyBudgetUsd: number;

  constructor() {
    // 注册 Provider（openai/claude 预留，配置了 key 才启用）
    this.register(new DeepSeekProvider());
    this.register(new GlmProvider());
    this.register(new GoogleTranslateProvider());
    if (process.env.OPENAI_API_KEY) {
      this.register(new OpenAICompatProvider({ id: 'openai', displayName: 'OpenAI', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', costPerMTokIn: 0.15, costPerMTokOut: 0.6 }));
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.register(new OpenAICompatProvider({ id: 'claude', displayName: 'Claude', model: 'claude-3-5-haiku-latest', baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1', costPerMTokIn: 0.8, costPerMTokOut: 4 }));
    }
    const budgetCny = parseFloat(process.env.MODEL_BUDGET_MONTHLY_CNY || '1000');
    this.monthlyBudgetUsd = budgetCny / 7.2; // 人民币→美元近似
  }

  private register(p: TranslateProvider) {
    this.providers.set(p.id, p);
  }

  /** 预算检查：超限返回 true（应降级） */
  private overBudget(): boolean {
    return this.monthCostUsd >= this.monthlyBudgetUsd;
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    // 1. 缓存命中（原文+语言+场景哈希，避免跨语言错用译文 2026-08-09）
    const hash = hashText(req.text, req.sourceLang, req.targetLang, req.scenario);
    const hit = getCache(hash);
    if (hit) {
      return { model: `cache:${hit.model}`, text: hit.result, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, cached: true } as TranslateResult & { cached: boolean };
    }

    // 2. 选路
    let candidates: string[];
    if (this.overBudget()) {
      candidates = ['glm']; // 预算超限，强制免费档
    } else if (req.scenario === 'ecommerce') {
      candidates = ['deepseek', 'google'];
    } else {
      candidates = ['deepseek', 'glm'];
    }

    let lastError = '';
    for (const id of candidates) {
      const p = this.providers.get(id);
      if (!p) continue;
      const result = await p.translate(req);
      if (!result.error && result.text) {
        // 3. 成功：记成本、写缓存（返回 cached 标记为 false）
        this.monthCostUsd += result.costUsd;
        setCache(hash, result.text, result.model);
        return result;
      }
      lastError = `${id}: ${result.error || 'empty'}`;
    }

    return { model: 'none', text: '', promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, error: `所有模型均失败 → ${lastError}` };
  }

  /** 多模型对比（盲测擂台用）：同原文调多个模型，匿名返回 */
  async translateAll(req: TranslateRequest, modelIds: string[]): Promise<TranslateResult[]> {
    const results: TranslateResult[] = [];
    for (const id of modelIds) {
      const p = this.providers.get(id);
      if (!p) continue;
      const r = await p.translate(req);
      if (!r.error && r.text) {
        this.monthCostUsd += r.costUsd;
        results.push(r);
      }
    }
    return results;
  }

  getProviders(): { id: string; displayName: string }[] {
    return [...this.providers.values()].map((p) => ({ id: p.id, displayName: p.displayName }));
  }

  getMonthCostUsd(): number {
    return this.monthCostUsd;
  }
}

/** 单例：整个进程共享一个路由器（成本累计、缓存共用） */
export const translator = new TranslatorRouter();
