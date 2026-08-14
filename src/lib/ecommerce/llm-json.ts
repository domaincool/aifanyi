/**
 * 跨境电商工作台 · 结构化 JSON 输出
 * 直接调用 DeepSeek（response_format=json_object）→ 失败降级 GLM
 * 不依赖 translator 文本翻译（纯文本输出），这里要求模型返回严格 JSON
 */

export interface LlmJsonResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  model?: string;
}

async function callJsonRaw(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  temperature: number,
  maxTokens: number,
  jsonMode: boolean,
): Promise<{ text: string; model: string }> {
  const body: any = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return { text: (data.choices?.[0]?.message?.content || '').trim(), model };
}

/** 提取 JSON 对象（容忍 ```json 围栏、前后杂讯） */
export function extractJsonObject(text: string): any {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 通用结构化 JSON 完成：DeepSeek 主路由（json mode），失败降级 GLM */
export async function llmJson<T>(opts: {
  systemPrompt: string;
  userContent: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<LlmJsonResult<T>> {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens ?? 2048;

  const candidates: { id: string; baseUrl: string; apiKey: string; model: string; jsonMode: boolean }[] = [];
  if (process.env.DEEPSEEK_API_KEY) {
    candidates.push({
      id: 'deepseek',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
      jsonMode: true,
    });
  }
  if (process.env.GLM_API_KEY) {
    candidates.push({
      id: 'glm',
      baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: process.env.GLM_API_KEY,
      model: 'glm-4-flash',
      jsonMode: true,
    });
  }
  if (candidates.length === 0) return { ok: false, error: '模型 API Key 未配置' };

  let lastError = '';
  for (const c of candidates) {
    try {
      const r = await callJsonRaw(c.baseUrl, c.apiKey, c.model, opts.systemPrompt, opts.userContent, temperature, maxTokens, c.jsonMode);
      const obj = extractJsonObject(r.text);
      if (obj && typeof obj === 'object') return { ok: true, data: obj as T, model: r.model };
      lastError = `${c.id}: JSON 解析失败`;
    } catch (e: any) {
      lastError = `${c.id}: ${e?.message || e}`;
    }
  }
  return { ok: false, error: `结构化输出失败 → ${lastError}` };
}
