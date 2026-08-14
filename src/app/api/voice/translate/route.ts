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

interface PipeResult { status: number; body: any }

/**
 * 三段流水线：STT → 翻译 → TTS（结算逻辑与旧版完全一致）
 * onStage：每段开始前回调（SSE 推送真实处理状态 RECORDING→TRANSCRIBING→TRANSLATING→SYNTHESIZING）
 * body 统一含 usedCredits（本次实际消耗，用户可见口径；TTS 降级失败段不计）
 */
async function runPipeline(authUserId: string, file: File, mime: string, durationSec: number, sourceLang: string, targetLang: string, scenario: string, onStage?: (s: string) => void): Promise<PipeResult> {
  const opened: Ctx[] = [];
  let usedCredits = 0;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length < 1024) return { status: 400, body: { ok: false, error: '录音太短或没有声音，请重新录制。' } };

    /* --- 1) STT --- */
    if (onStage) onStage('TRANSCRIBING');
    const sttJob = 'vstt_' + crypto.randomUUID();
    const sttEst = secondsToUnits(durationSec);
    const b1 = await beginSync({ userId: authUserId, jobId: sttJob, feature: FEATURES.STT, estimatedCredits: sttEst });
    if (!b1.ok) {
      const status = b1.code === 'insufficient' ? 402 : 400;
      return { status, body: { ok: false, error: b1.error } };
    }
    opened.push({ jobId: sttJob, usageId: b1.usageId, estimated: b1.estimated, userId: authUserId });

    const stt = await transcribeAudio(buf, mime, sourceLang);
    if (!stt.ok) {
      await endSyncFail({ userId: authUserId, jobId: sttJob, usageId: b1.usageId, estimated: b1.estimated });
      opened.pop();
      return { status: 502, body: { ok: false, error: stt.error } };
    }
    await endSyncSuccess({ userId: authUserId, jobId: sttJob, usageId: b1.usageId, estimated: b1.estimated, actualCredits: sttEst });
    usedCredits += sttEst;
    opened.pop();
    const text = stt.text;

    /* --- 2) 翻译（复用路由引擎：缓存命中免扣 / 预算降级）--- */
    if (onStage) onStage('TRANSLATING');
    const trJob = 'vtr_' + crypto.randomUUID();
    const trEst = await estimateByChars(FEATURES.TEXT, text.length);
    const b2 = await beginSync({ userId: authUserId, jobId: trJob, feature: FEATURES.TEXT, estimatedCredits: trEst });
    if (!b2.ok) {
      const status = b2.code === 'insufficient' ? 402 : 400;
      return { status, body: { ok: false, error: b2.error } };
    }
    opened.push({ jobId: trJob, usageId: b2.usageId, estimated: b2.estimated, userId: authUserId });

    const tr = await translator.translate({ text, sourceLang, targetLang, scenario });
    if (!tr || !tr.text || tr.error) {
      await endSyncFail({ userId: authUserId, jobId: trJob, usageId: b2.usageId, estimated: b2.estimated });
      opened.pop();
      return { status: 502, body: { ok: false, error: '翻译失败，请重试。' } };
    }
    const trActual = tr.cached ? 0 : trEst;
    await endSyncSuccess({ userId: authUserId, jobId: trJob, usageId: b2.usageId, estimated: b2.estimated, actualCredits: trActual });
    usedCredits += trActual;
    opened.pop();
    const translation = tr.text;

    /* --- 3) TTS（失败不致命：仍返回文字结果）--- */
    if (onStage) onStage('SYNTHESIZING');
    const ttsJob = 'vtts_' + crypto.randomUUID();
    const ttsEst = charsToUnits(translation.length);
    const b3 = await beginSync({ userId: authUserId, jobId: ttsJob, feature: FEATURES.TTS, estimatedCredits: ttsEst });
    if (!b3.ok) {
      const status = b3.code === 'insufficient' ? 402 : 400;
      return { status, body: { ok: false, error: b3.error } };
    }
    opened.push({ jobId: ttsJob, usageId: b3.usageId, estimated: b3.estimated, userId: authUserId });

    const tts = await synthesizeSpeech(translation, {});
    let audioBase64: string | null = null;
    let ttsFailed = false;
    if (tts.ok) {
      await endSyncSuccess({ userId: authUserId, jobId: ttsJob, usageId: b3.usageId, estimated: b3.estimated, actualCredits: ttsEst });
      usedCredits += ttsEst;
      audioBase64 = tts.audio.toString('base64');
    } else {
      await endSyncFail({ userId: authUserId, jobId: ttsJob, usageId: b3.usageId, estimated: b3.estimated });
      ttsFailed = true;
    }
    opened.pop();

    return { status: 200, body: { ok: true, text, translation, model: tr.model, cached: !!tr.cached, audioBase64, ttsFailed, usedCredits } };
  } catch (e: any) {
    for (const c of opened) {
      await endSyncFail({ userId: c.userId, jobId: c.jobId, usageId: c.usageId, estimated: c.estimated }).catch(() => {});
    }
    return { status: 500, body: { ok: false, error: '语音翻译失败，请重试。' } };
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUserId();
  if (!auth) return NextResponse.json(authErrorBody(), { status: 401 });
  if (!(await checkRateLimit(auth.userId))) {
    return NextResponse.json({ ok: false, error: '操作太频繁，请稍后再试。' }, { status: 429 });
  }

  const sp = req.nextUrl.searchParams;
  const stream = sp.get('stream') === '1';

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

  if (!stream) {
    // 非流式：原响应结构 + usedCredits（兼容首页 VoiceTranslateButton / 既有 E2E）
    const r = await runPipeline(auth.userId, file, mime, durationSec, sourceLang, targetLang, scenario);
    return NextResponse.json(r.body, { status: r.status });
  }

  // SSE 流式：真实处理状态（RECORDING 由前端发，后端推送 TRANSCRIBING→TRANSLATING→SYNTHESIZING→result）
  const encoder = new TextEncoder();
  const sseBody = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => {
        try { controller.enqueue(encoder.encode('data: ' + JSON.stringify(obj) + '\n\n')); } catch {}
      };
      const r = await runPipeline(auth.userId, file, mime, durationSec, sourceLang, targetLang, scenario, (stage) => {
        send({ type: 'status', state: stage });
      });
      if (r.body && r.body.ok) {
        send({ type: 'result', ok: true, ...r.body });
      } else {
        send({ type: 'result', ok: false, error: (r.body && r.body.error) || '语音翻译失败，请重试。', status: r.status });
      }
      try { controller.close(); } catch {}
    },
  });
  return new Response(sseBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
