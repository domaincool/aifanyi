'use client';

import { useRef, useState } from 'react';

/**
 * 麦克风语音输入按钮（V1）
 * 状态机：idle → recording → processing → success/error
 * 录音：Web Audio API 采集 → 前端 WAV 编码（16bit PCM）→ /api/voice/transcribe
 * 权限拒绝/取消/无声音 → 明确中文提示，不抛技术错误
 */
interface Props {
  sourceLang: string;
  onResult: (text: string) => void;
  disabled?: boolean;
}

type Phase = 'idle' | 'recording' | 'processing' | 'error';

/**
 * 编码 WAV：清洗 NaN/Infinity + 线性插值重采样到 16kHz（ASR 最佳实践，文件更小更稳）
 */
const TARGET_SR = 16000;

function encodeWav(raw: Float32Array, sampleRate: number): Blob {
  // 1) 清洗异常采样值
  const cleaned = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    cleaned[i] = Number.isFinite(s) ? s : 0;
  }
  // 2) 重采样到 16k（线性插值）
  let samples: Float32Array = cleaned;
  if (sampleRate !== TARGET_SR && sampleRate > 0) {
    const outLen = Math.max(1, Math.round((cleaned.length * TARGET_SR) / sampleRate));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const p = (i * sampleRate) / TARGET_SR;
      const i0 = Math.floor(p);
      const i1 = Math.min(i0 + 1, cleaned.length - 1);
      const f = p - i0;
      out[i] = cleaned[i0] * (1 - f) + cleaned[i1] * f;
    }
    samples = out;
  }
  // 3) 编码 16bit PCM WAV
  const sr = TARGET_SR;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const ASR_LANG: Record<string, string> = {
  zh: 'zh', en: 'en', ja: 'ja', ko: 'ko', fr: 'fr', de: 'de', es: 'es', ru: 'ru', pt: 'pt', ar: 'ar',
};

export default function VoiceInputButton({ sourceLang, onResult, disabled }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [sec, setSec] = useState(0);
  const [error, setError] = useState('');
  const ctxRef = useRef<{ ctx: AudioContext; source: MediaStreamAudioSourceNode; proc: ScriptProcessorNode; stream: MediaStream; chunks: Float32Array[]; start: number } | null>(null);
  const timerRef = useRef<any>(null);

  function stopAll() {
    const r = ctxRef.current;
    if (r) {
      try { r.proc.disconnect(); } catch {}
      try { r.source.disconnect(); } catch {}
      try { r.stream.getTracks().forEach((t) => t.stop()); } catch {}
      try { r.ctx.close(); } catch {}
    }
    ctxRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startRecord() {
    setError('');
    setSec(0);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPhase('error');
      setError('当前浏览器不支持录音，请使用 Chrome / Safari 最新版。');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      setPhase('error');
      if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) setError('麦克风权限被拒绝，请在浏览器设置中允许后重试。');
      else if (e && e.name === 'NotFoundError') setError('未检测到麦克风设备。');
      else setError('无法访问麦克风。');
      return;
    }
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d));
      };
      source.connect(proc);
      proc.connect(ctx.destination);
      ctxRef.current = { ctx, source, proc, stream, chunks, start: Date.now() };
      setPhase('recording');
      timerRef.current = setInterval(() => setSec(Math.round((Date.now() - ctxRef.current!.start) / 1000)), 500);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setPhase('error');
      setError('录音初始化失败，请重试。');
    }
  }

  async function stopRecord() {
    const r = ctxRef.current;
    if (!r) return;
    const durationSec = Math.max(1, Math.round((Date.now() - r.start) / 1000));
    const total = r.chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of r.chunks) { merged.set(c, off); off += c.length; }
    stopAll();
    setSec(0);
    if (durationSec > 30) {
      setPhase('error');
      setError('单次录音限 30 秒，请分句录制。');
      return;
    }
    if (total < 1600) {
      setPhase('error');
      setError('没有听到声音，请再说一次。');
      return;
    }
    setPhase('processing');
    try {
      const wav = encodeWav(merged, r.ctx.sampleRate);
      const fd = new FormData();
      fd.append('file', wav, 'rec.wav');
      fd.append('mime', 'audio/wav');
      fd.append('duration', String(durationSec));
      fd.append('language', ASR_LANG[sourceLang] || 'zh');
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) {
        setPhase('error');
        setError(data.error || '语音识别失败，请重试。');
        if (res.status === 401) window.dispatchEvent(new CustomEvent('open-login-modal'));
        return;
      }
      setPhase('idle');
      onResult(data.text);
    } catch {
      setPhase('error');
      setError('网络异常，语音识别失败。');
    }
  }

  function cancel() {
    stopAll();
    setSec(0);
    setPhase('idle');
  }

  return (
    <div className="voice-input" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {phase === 'idle' && (
        <button
          type="button"
          className="voice-btn"
          title="语音输入（说一句话，自动转文字）"
          aria-label="语音输入"
          disabled={disabled}
          onClick={startRecord}
        >
          🎤
        </button>
      )}
      {phase === 'recording' && (
        <span className="voice-rec" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="voice-rec-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'voicePulse 1s infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>正在录音 {sec}s</span>
          <button type="button" className="voice-btn-done" style={{ padding: '3px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }} onClick={stopRecord}>完成</button>
          <button type="button" className="voice-btn-cancel" style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }} onClick={cancel}>取消</button>
        </span>
      )}
      {phase === 'processing' && (
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>识别中…</span>
      )}
      {phase === 'error' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
          <button type="button" className="voice-btn" title="重试" onClick={() => { setPhase('idle'); setError(''); }}>🎤</button>
        </span>
      )}
      <style>{'@keyframes voicePulse{0%,100%{opacity:1}50%{opacity:.3}}'}</style>
    </div>
  );
}
