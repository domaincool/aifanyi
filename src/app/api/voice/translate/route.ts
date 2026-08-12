import { NextRequest, NextResponse } from 'next/server';
import { translator } from '@/lib/translator/router';
import { getAuthUserId, authErrorBody, beginSync, endSyncSuccess, endSyncFail, estimateByChars, FEATURES } from '@/lib/credit/sync-settle';
import { transcribeAudio } from '@/lib/voice/asr';
import { synthesizeSpeech } from '@/lib/voice/tts';
import { checkRateLimit, VOICE_LIMITS } from '@/lib/voice/limits';
import { secondsToUnits, charsToUnits } from '@/lib/credit/pricing';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface Ctx { jobId: string; usageId: string; estimated: number; userId: string }

export async function POST(req: NextRequest) {
  const opened: Ctx[] = []; // 已 begin 未结算的段（失败时退回）
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
    const sourceLang = String(form.get('sourceLang') || 'zh');
    const targetLang = String(form.get('targetLang') || 'en');
    const scenario = String(form.get('scenario') || 'general');

    if (!file || !file.name) return NextResponse.json({ ok: false, error: '请上传录音文件。' }, { status: 400 });
    if (!/^(audio\/(wav|wave|x-wav|mpeg|mp3))/.test(mime)) {
      return NextResponse.json({ ok: false, error: '仅支持 WAV / MP3 录音。' }, { status: 400 });
    }
    if (file.size > VOICE_LIMITS.maxBytes) return NextResponse.json({ ok: false, error: '录音过大（限 25MB）。' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    // 空/过小文件：在 ASR 前拦截（避免空音频打到智谱产生 502）
    if (buf.length < 1024) {
      return NextResponse.json({ ok: false, error: '录音太短或没有声音，请重新录制。' }, { status: 400 });
    }

    /* --- 1) STT --- */
    const sttJob = 'vstt_' + crypto.randomUUID();
    const sttEst = secondsToUnits(durationSec);
    const b1 = await beginSync({ userId: auth.userId, jobId: sttJob, feature: FEATURES.STT, estimatedCredits: sttEst });
    if (!b1.ok) {
      const status = b1.code === 'insufficient' ? 402 : 400;
      return NextResponse.json({ ok: false, error: b1.error }, { status });
    }
    opened.push({ jobId: sttJob, usageId: b1.usageId, estimated: b1.estimated, userId: auth.userId });

    const stt = await transcribeAudio(buf, mime, sourceLang);
    if (!stt.ok) {
      await endSyncFail({ userId: auth.userId, jobId: sttJob, usageId: b1.usageId, estimated: b1.estimated });
      opened.pop();
      return NextResponse.json({ ok: false, error: stt.error }, { status: 502 });
    }
    await endSyncSuccess({ userId: auth.userId, jobId: sttJob, usageId: b1.usageId, estimated: b1.estimated, actualCredits: sttEst });
    opened.pop();
    const text = stt.text;

    /* --- 2) 翻译（复用路由引擎：缓存命中免扣 / 预算降级）--- */
    const trJob = 'vtr_' + crypto.randomUUID();
    const trEst = await estimateByChars(FEATURES.TEXT, text.length);
    const b2 = await beginSync({ userId: auth.userId, jobId: trJob, feature: FEATURES.TEXT, estimatedCredits: trEst });
    if (!b2.ok) {
      const status = b2.code === 'insufficient' ? 402 : 400;
      return NextResponse.json({ ok: false, error: b2.error }, { status });
    }
    opened.push({ jobId: trJob, usageId: b2.usageId, estimated: b2.estimated, userId: auth.userId });

    const tr = await translator.translate({ text, sourceLang, targetLang, scenario });
    if (!tr || !tr.text || tr.error) {
      await endSyncFail({ userId: auth.userId, jobId: trJob, usageId: b2.usageId, estimated: b2.estimated });
      opened.pop();
      return NextResponse.json({ ok: false, error: '翻译失败，请重试。' }, { status: 502 });
    }
    await endSyncSuccess({ userId: auth.userId, jobId: trJob, usageId: b2.usageId, estimated: b2.estimated, actualCredits: tr.cached ? 0 : trEst });
    opened.pop();
    const translation = tr.text;

    /* --- 3) TTS（失败不致命：仍返回文字结果）--- */
    const ttsJob = 'vtts_' + crypto.randomUUID();
    const ttsEst = charsToUnits(translation.length);
    const b3 = await beginSync({ userId: auth.userId, jobId: ttsJob, feature: FEATURES.TTS, estimatedCredits: ttsEst });
    if (!b3.ok) {
      const status = b3.code === 'insufficient' ? 402 : 400;
      return NextResponse.json({ ok: false, error: b3.error }, { status });
    }
    opened.push({ jobId: ttsJob, usageId: b3.usageId, estimated: b3.estimated, userId: auth.userId });

    const tts = await synthesizeSpeech(translation, {});
    let audioBase64: string | null = null;
    let ttsFailed = false;
    if (tts.ok) {
      await endSyncSuccess({ userId: auth.userId, jobId: ttsJob, usageId: b3.usageId, estimated: b3.estimated, actualCredits: ttsEst });
      audioBase64 = tts.audio.toString('base64');
    } else {
      await endSyncFail({ userId: auth.userId, jobId: ttsJob, usageId: b3.usageId, estimated: b3.estimated });
      ttsFailed = true;
    }
    opened.pop();

    return NextResponse.json({ ok: true, text, translation, model: tr.model, cached: !!tr.cached, audioBase64, ttsFailed });
  } catch (e: any) {
    for (const c of opened) {
      await endSyncFail({ userId: c.userId, jobId: c.jobId, usageId: c.usageId, estimated: c.estimated }).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: '语音翻译失败，请重试。' }, { status: 500 });
  }
}
