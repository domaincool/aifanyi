/**
 * /api/metrics/intent — 语言意图埋点上报（V1.1 P1-7）
 *
 * 设计原则：埋点绝不能影响主流程 —— 任何异常/非法输入都返回 { ok: true }。
 * 隐私：IP 仅用于内存限流，绝不落表；query 侧敏感内容由 recordLanguageIntent 脱敏。
 */
import { NextResponse } from 'next/server';
import { recordLanguageIntent } from '@/lib/metrics/server';

export const dynamic = 'force-dynamic';

const INTENTS = ['translate', 'meaning', 'hidden_meaning', 'speak', 'other'];
const CONTENT_MATCH = ['none', 'exact', 'partial', 'zero'];

/** 长度白名单：超长即截断，非字符串一律丢弃 */
const clampStr = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

// IP 内存限流：30 次/分钟（写法照抄 /api/ask/classify；单机内存计数，网关后可换 Redis）
const RL = new Map<string, { n: number; reset: number }>();
function rateLimited(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const r = RL.get(ip);
  if (!r || now > r.reset) {
    RL.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  r.n++;
  return r.n > limit;
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (rateLimited(ip)) return NextResponse.json({ ok: true, limited: true }, { status: 429 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return NextResponse.json({ ok: true });

    const query = clampStr(body.query, 200);
    if (!query) return NextResponse.json({ ok: true });

    const intentRaw = clampStr(body.intent, 32) || 'other';
    const intent = INTENTS.includes(intentRaw) ? intentRaw : 'other';
    const cmRaw = clampStr(body.contentMatch, 16) || 'none';
    const contentMatch = (CONTENT_MATCH.includes(cmRaw) ? cmRaw : 'none') as 'none' | 'exact' | 'partial' | 'zero';

    await recordLanguageIntent({
      eventId: clampStr(body.eventId, 128) || undefined,
      query,
      intent,
      confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
      source: clampStr(body.source, 32) || undefined,
      channel: clampStr(body.channel, 64),
      language: clampStr(body.language, 64),
      targetLang: clampStr(body.targetLang, 64),
      entity: clampStr(body.entity, 64),
      scenario: clampStr(body.scenario, 64),
      contentMatch,
      contentId: clampStr(body.contentId, 64),
      contentType: clampStr(body.contentType, 64),
      toolUsed: clampStr(body.toolUsed, 64),
      toolType: clampStr(body.toolType, 64),
      sessionKey: clampStr(body.sessionKey, 64),
    });

    return NextResponse.json({ ok: true });
  } catch {
    // 埋点链路永不影响调用方
    return NextResponse.json({ ok: true });
  }
}
