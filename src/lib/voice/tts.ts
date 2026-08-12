/**
 * GLM-TTS 语音合成适配
 * 端点：POST /api/paas/v4/audio/speech
 * 音色：tongtong(童童) / jam / douji / kazi / luodo / chuichui / cogtts
 * 输出：wav；文本哈希缓存（24h）→ 重复朗读零成本
 */
const API = 'https://open.bigmodel.cn/api/paas/v4/audio/speech';
const MODEL = 'glm-tts';
const VOICES = ['tongtong', 'jam', 'douji', 'kazi', 'luodo', 'chuichui', 'cogtts'];
const DEFAULT_VOICE = 'tongtong';

const cache = new Map<string, { audio: Buffer; at: number }>();
const TTL = 24 * 3600 * 1000;

function voiceKey(): string | null {
  return process.env.GLM_VOICE_API_KEY || process.env.GLM_API_KEY || null;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return 'v' + h;
}

export async function synthesizeSpeech(
  text: string,
  opts: { voice?: string } = {}
): Promise<{ ok: true; audio: Buffer; mime: string; cached: boolean } | { ok: false; error: string }> {
  const key = voiceKey();
  if (!key) return { ok: false, error: '语音服务未配置，请联系管理员。' };
  const voice = opts.voice && VOICES.includes(opts.voice) ? opts.voice : DEFAULT_VOICE;
  const h = hash(voice + ':' + text);
  const hit = cache.get(h);
  if (hit && Date.now() - hit.at < TTL) return { ok: true, audio: hit.audio, mime: 'audio/wav', cached: true };
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: text, voice, response_format: 'wav', sample_rate: 24000, speed: 1.0 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: '语音合成服务暂不可用（' + res.status + '）。' };
    }
    const audio = Buffer.from(await res.arrayBuffer());
    cache.set(h, { audio, at: Date.now() });
    return { ok: true, audio, mime: 'audio/wav', cached: false };
  } catch (e: any) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return { ok: false, error: '语音合成超时，请重试。' };
    return { ok: false, error: '语音合成失败，请重试。' };
  }
}

export function getVoices(): string[] {
  return VOICES;
}
