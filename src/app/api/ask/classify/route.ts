import { NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';

export const dynamic = 'force-dynamic';

/**
 * Ask AIFANYI L3 —— AI 意图分类（流量增长 V1.0 P7 裁决）
 * L1 正则命中直接返回（零成本）；未命中走 DeepSeek JSON 契约分类，
 * 七枚举（与 MemeEntry.searchIntentType 对齐）映射三路由；失败/超时降级 translate（L4 兜底在客户端 = 翻译框）。
 */
const deepseek = new DeepSeekProvider();

type Intent3 = 'meaning' | 'speak' | 'translate';
const SEVEN = ['definition', 'meaning', 'translation', 'how_to_say', 'hidden_meaning', 'comparison', 'cultural_context'];
const TO_ROUTE: Record<string, Intent3> = {
  definition: 'meaning',
  meaning: 'meaning',
  hidden_meaning: 'meaning',
  comparison: 'meaning',
  cultural_context: 'meaning',
  how_to_say: 'speak',
  translation: 'translate',
};

const RULES: [RegExp, Intent3][] = [
  [/什么意思|啥意思|是什么意思|什么内涵|什么梗|是不是在|暗示|潜台词|mean|meaning/i, 'meaning'],
  [/怎么说|怎么讲|怎么表达|怎么翻译成|用.{0,8}(说|表达)|how to say|how do (i|you) say/i, 'speak'],
];

const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { route: Intent3; raw: string; at: number }>();

function l1(q: string): Intent3 | null {
  for (const [re, intent] of RULES) if (re.test(q)) return intent;
  return null;
}

function parseSeven(text: string): string | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    const v = String(obj.intent || '').trim().toLowerCase();
    return SEVEN.includes(v) ? v : null;
  } catch {
    return null;
  }
}

const PROMPT = (q: string) =>
  '你是语言学习产品的意图分类器。判断用户问题的真实意图，只输出 JSON，不要输出任何其他内容：\n' +
  '{"intent":"definition|meaning|translation|how_to_say|hidden_meaning|comparison|cultural_context"}\n' +
  '- definition/meaning/hidden_meaning/comparison/cultural_context：问词语含义、用法、区别、背景、潜台词\n' +
  '- translation：想把一段完整的话翻译成另一种语言（要译文）\n' +
  '- how_to_say：问某个意思/场景该怎么说、怎么表达（要表达方式）\n' +
  '用户问题：' + q;

// __p0fix-rl__ IP 内存限流：公开 LLM 端点防滥用（单机内存计数，网关后可换 Redis）
const RL = new Map<string, { n: number; reset: number }>();
function rateLimited(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const r = RL.get(ip);
  if (!r || now > r.reset) { RL.set(ip, { n: 1, reset: now + windowMs }); return false; }
  r.n++;
  return r.n > limit;
}

export async function POST(req: Request) {
  let q = '';
  try {
    const body = await req.json();
    q = String(body?.q || '').trim().slice(0, 300);
  } catch {}
  if (!q) return NextResponse.json({ ok: false, error: 'missing q' }, { status: 400 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 }); // __p0fix-rl__

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ ok: true, intent: hit.route, raw: hit.raw, cached: true });
  }

  const local = l1(q);
  if (local) {
    cache.set(key, { route: local, raw: 'l1', at: Date.now() });
    return NextResponse.json({ ok: true, intent: local, raw: 'l1', cached: false });
  }

  try {
    const res = await Promise.race([
      deepseek.translate({ text: PROMPT(q), sourceLang: 'auto', targetLang: 'zh', scenario: 'ask', maxTokens: 64 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    const raw = res ? parseSeven(res.text) : null;
    const route: Intent3 = raw ? TO_ROUTE[raw] || 'translate' : 'translate';
    if (raw) cache.set(key, { route, raw, at: Date.now() });
    return NextResponse.json({ ok: true, intent: route, raw: raw || 'fallback', cached: false });
  } catch {
    return NextResponse.json({ ok: true, intent: 'translate', raw: 'error_fallback', cached: false });
  }
}
