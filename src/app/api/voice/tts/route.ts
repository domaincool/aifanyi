import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, authErrorBody, beginSync, endSyncSuccess, endSyncFail, FEATURES } from '@/lib/credit/sync-settle';
import { synthesizeSpeech } from '@/lib/voice/tts';
import { checkRateLimit, VOICE_LIMITS } from '@/lib/voice/limits';
import { charsToUnits } from '@/lib/credit/pricing';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  try {
    const auth = await getAuthUserId();
    if (!auth) return NextResponse.json(authErrorBody(), { status: 401 });
    if (!(await checkRateLimit(auth.userId))) {
      return NextResponse.json({ ok: false, error: '操作太频繁，请稍后再试。' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const text = String((body && body.text) || '').trim();
    const voice = String((body && body.voice) || 'tongtong');
    if (!text) return NextResponse.json({ ok: false, error: '请输入要朗读的文本。' }, { status: 400 });
    if (text.length > VOICE_LIMITS.maxTextChars) {
      return NextResponse.json({ ok: false, error: '文本过长（限 500 字符），请分段朗读。' }, { status: 400 });
    }

    const jobId = 'tts_' + crypto.randomUUID();
    const est = charsToUnits(text.length);
    const begin = await beginSync({ userId: auth.userId, jobId, feature: FEATURES.TTS, estimatedCredits: est });
    if (!begin.ok) {
      const status = begin.code === 'insufficient' ? 402 : 400;
      return NextResponse.json({ ok: false, error: begin.error }, { status });
    }
    creditCtx = { jobId, usageId: begin.usageId, estimated: begin.estimated, userId: auth.userId };

    const r = await synthesizeSpeech(text, { voice });
    if (!r.ok) {
      await endSyncFail({ userId: auth.userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
      creditCtx = null;
      return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    }

    await endSyncSuccess({
      userId: auth.userId,
      jobId,
      usageId: begin.usageId,
      estimated: begin.estimated,
      actualCredits: est,
    });
    creditCtx = null;

    const res = new NextResponse(new Uint8Array(r.audio), { status: 200, headers: { 'Content-Type': r.mime, 'Cache-Control': r.cached ? 'public, max-age=86400' : 'no-store' } });
    return res;
  } catch (e: any) {
    if (creditCtx) {
      await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated }).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: '语音合成失败，请重试。' }, { status: 500 });
  }
}
