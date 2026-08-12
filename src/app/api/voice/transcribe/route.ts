import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, authErrorBody, beginSync, endSyncSuccess, endSyncFail, FEATURES } from '@/lib/credit/sync-settle';
import { transcribeAudio } from '@/lib/voice/asr';
import { checkRateLimit, VOICE_LIMITS } from '@/lib/voice/limits';
import { secondsToUnits } from '@/lib/credit/pricing';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  try {
    const auth = await getAuthUserId();
    if (!auth) return NextResponse.json(authErrorBody(), { status: 401 });
    if (!checkRateLimit(auth.userId)) {
      return NextResponse.json({ ok: false, error: '操作太频繁，请稍后再试。' }, { status: 429 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const mime = String(form.get('mime') || 'audio/wav');
    const durationSec = Math.min(VOICE_LIMITS.maxSeconds, Math.max(1, parseInt(String(form.get('duration') || '5'), 10) || 5));
    const language = String(form.get('language') || 'zh');

    if (!file || !file.name) {
      return NextResponse.json({ ok: false, error: '请上传录音文件。' }, { status: 400 });
    }
    if (!/^(audio\/(wav|wave|x-wav|mpeg|mp3))/.test(mime)) {
      return NextResponse.json({ ok: false, error: '仅支持 WAV / MP3 录音。' }, { status: 400 });
    }
    if (file.size > VOICE_LIMITS.maxBytes) {
      return NextResponse.json({ ok: false, error: '录音过大（限 25MB）。' }, { status: 400 });
    }

    const jobId = 'stt_' + crypto.randomUUID();
    const est = secondsToUnits(durationSec);
    const begin = await beginSync({ userId: auth.userId, jobId, feature: FEATURES.STT, estimatedCredits: est });
    if (!begin.ok) {
      const status = begin.code === 'insufficient' ? 402 : 400;
      return NextResponse.json({ ok: false, error: begin.error }, { status });
    }
    creditCtx = { jobId, usageId: begin.usageId, estimated: begin.estimated, userId: auth.userId };

    const buf = Buffer.from(await file.arrayBuffer());
    const r = await transcribeAudio(buf, mime, language);
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
    return NextResponse.json({ ok: true, text: r.text, durationSec });
  } catch (e: any) {
    if (creditCtx) {
      await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated }).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: '语音识别失败，请重试。' }, { status: 500 });
  }
}
