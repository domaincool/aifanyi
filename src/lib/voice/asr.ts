/**
 * GLM-ASR-2512 语音识别适配
 * 端点：POST /api/paas/v4/audio/transcriptions（OpenAI 风格 multipart）
 * 限制：wav/mp3，≤25MB，≤30s；60s 超时
 */
const API = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions';
const MODEL = 'glm-asr-2512';

function voiceKey(): string | null {
  return process.env.GLM_VOICE_API_KEY || process.env.GLM_API_KEY || null;
}

export async function transcribeAudio(
  file: Buffer,
  mime: string,
  language = 'zh'
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = voiceKey();
  if (!key) return { ok: false, error: '语音服务未配置，请联系管理员。' };
  const ext = mime.includes('wav') || mime.includes('wave') ? 'wav' : 'mp3';
  try {
    const form = new FormData();
    form.append('model', MODEL);
    form.append('file', new Blob([new Uint8Array(file)], { type: mime }), 'audio.' + ext);
    form.append('language', language);
    form.append('response_format', 'json');
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: '语音识别服务暂不可用（' + res.status + '）。' };
    }
    const data = await res.json();
    const text = (data.text || '').trim();
    if (!text) return { ok: false, error: '没有听清，请再说一次。' };
    return { ok: true, text };
  } catch (e: any) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return { ok: false, error: '语音识别超时，请重试。' };
    return { ok: false, error: '语音识别失败，请重试。' };
  }
}
