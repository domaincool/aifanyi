import { NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';
import { recordSearchQuery } from '@/lib/metrics/server';

export const dynamic = 'force-dynamic';

/**
 * Ask AI 兜底作答（P1：无匹配页三死链修复 · 正式方案）
 * 场景：/understand/meaning?q=xxx 五表查询零命中 → 无匹配页内联 AI 答案卡片调用本端点。
 * - meaning：解释词义/背景/潜台词；speak：给地道英文表达（保持 speak 的独立人格）
 * - 护栏：16 字符纯 meaning 词 → 64 token 快答；否则 300 token 全答
 * - 观测：recordSearchQuery(aiAnswerUsed=true)（选词雷达口径：高频无匹配词 = 下一批词条候选）
 * - 缓存：进程内 6h（幂等刷新省钱）；限流：20/min/IP（与 classify 同款）
 */
const deepseek = new DeepSeekProvider();

const RL = new Map<string, { n: number; reset: number }>();
function rateLimited(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const r = RL.get(ip);
  if (!r || now > r.reset) { RL.set(ip, { n: 1, reset: now + windowMs }); return false; }
  r.n++;
  return r.n > limit;
}

const CACHE_TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { answer: string; at: number }>();

function rateLimitedV2(ip: string): boolean {
  return rateLimited(ip);
}

const PROMPT = (q: string, mode: string) =>
  mode === 'speak'
    ? '你是双语表达教练。用户想表达：' + q + '\n给出 1-2 个地道英文表达（区分口语/正式），每个附中文说明与一句英文例句。总长不超过 150 字，不要输出任何多余寒暄。'
    : '你是双语词典编辑。用户问：' + q + '\n用简体中文直接回答这个词/这句话的含义（若是网络用语/俚语，讲清含义与使用场景；若是英文词，给出中文意思与用法提示）。总长不超过 150 字，直接给答案，不要输出「好的」之类的寒暄。';

export async function POST(req: Request) {
  let q = '';
  let mode = 'meaning';
  try {
    const body = await req.json();
    q = String(body?.q || '').trim().slice(0, 200);
    mode = body?.mode === 'speak' ? 'speak' : 'meaning';
  } catch {}
  if (!q) return NextResponse.json({ ok: false, error: 'missing q' }, { status: 400 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (rateLimitedV2(ip)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const key = mode + '|' + q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json({ ok: true, answer: hit.answer, cached: true });
  }

  const maxTokens = mode === 'meaning' && q.length <= 16 ? 64 : 300;
  try {
    const res = await Promise.race([
      deepseek.translate({ text: PROMPT(q, mode), sourceLang: 'auto', targetLang: 'zh', scenario: 'ask', maxTokens }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
    ]);
    const answer = res ? res.text.trim() : '';
    if (!answer) return NextResponse.json({ ok: false, error: 'ai_unavailable' }, { status: 502 });
    cache.set(key, { answer, at: Date.now() });
    // 选词雷达：AI 兜底 = 高频无匹配词候选（aiAnswerUsed 口径），失败静默不影响响应
    recordSearchQuery(q, 0, true).catch(() => {});
    return NextResponse.json({ ok: true, answer, cached: false });
  } catch {
    return NextResponse.json({ ok: false, error: 'ai_unavailable' }, { status: 502 });
  }
}
