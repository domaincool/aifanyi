'use client';

import { useRef, useState } from 'react';

/**
 * 一键语音翻译（V2）：按一下麦克风 → 说话 → 自动识别+翻译+朗读译文
 * 流程：录音 → WAV(16k) → /api/voice/translate（STT→翻译→TTS 组合结算）
 * 自动播放：默认关（localStorage aifanyi_autoplay）；开启且被浏览器拦截 → 提示「点击播放译文」
 * TTS 失败：仍显示文字译文（不整体失败）
 */
interface Props {
  sourceLang: string;
  targetLang: string;
  disabled?: boolean;
}

type Phase = 'idle' | 'recording' | 'translating' | 'error';

const TARGET_SR = 16000;

function encodeWav(raw: Float32Array, sampleRate: number): Blob {
  const cleaned = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    cleaned[i] = Number.isFinite(s) ? s : 0;
  }
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
  view.setUint32(24, TARGET_SR, true);
  view.setUint32(28, TARGET_SR * 2, true);
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

export default function VoiceTranslateButton({ sourceLang, targetLang, disabled }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [sec, setSec] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ text: string; translation: string; audioBase64: string | null; ttsFailed: boolean } | null>(null);
  const [autoplay, setAutoplay] = useState<boolean>(() => { try { return localStorage.getItem('aifanyi_autoplay') === '1'; } catch { return false; } });
  const [playHint, setPlayHint] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<{ ctx: AudioContext; source: MediaStreamAudioSourceNode; proc: ScriptProcessorNode; stream: MediaStream; chunks: Float32Array[]; start: number } | null>(null);
  const timerRef = useRef<any>(null);

  function stopAll() {
    const r = recRef.current;
    if (r) {
      try { r.proc.disconnect(); } catch {}
      try { r.source.disconnect(); } catch {}
      try { r.stream.getTracks().forEach((t) => t.stop()); } catch {}
      try { r.ctx.close(); } catch {}
    }
    recRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startRecord() {
    setError('');
    setResult(null);
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
      recRef.current = { ctx, source, proc, stream, chunks, start: Date.now() };
      setPhase('recording');
      timerRef.current = setInterval(() => setSec(Math.round((Date.now() - recRef.current!.start) / 1000)), 500);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setPhase('error');
      setError('录音初始化失败，请重试。');
    }
  }

  async function stopAndTranslate() {
    const r = recRef.current;
    if (!r) return;
    const durationSec = Math.max(1, Math.round((Date.now() - r.start) / 1000));
    const total = r.chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of r.chunks) { merged.set(c, off); off += c.length; }
    stopAll();
    setSec(0);
    if (durationSec > 30) { setPhase('error'); setError('单次录音限 30 秒，请分句录制。'); return; }
    if (total < 1600) { setPhase('error'); setError('没有听到声音，请再说一次。'); return; }
    setPhase('translating');
    try {
      const wav = encodeWav(merged, r.ctx.sampleRate);
      const fd = new FormData();
      fd.append('file', wav, 'rec.wav');
      fd.append('mime', 'audio/wav');
      fd.append('duration', String(durationSec));
      fd.append('sourceLang', sourceLang);
      fd.append('targetLang', targetLang);
      const res = await fetch('/api/voice/translate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) {
        setPhase('error');
        setError(data.error || '语音翻译失败，请重试。');
        if (res.status === 401) window.dispatchEvent(new CustomEvent('open-login-modal'));
        return;
      }
      setPhase('idle');
      setResult({ text: data.text, translation: data.translation, audioBase64: data.audioBase64 || null, ttsFailed: !!data.ttsFailed });
      if (data.audioBase64) {
        const url = 'data:audio/wav;base64,' + data.audioBase64;
        if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
        const au = new Audio(url);
        audioRef.current = au;
        if (autoplay) {
          au.play().catch(() => { setPlayHint(true); }); // Autoplay Policy：被拦截 → 提示点击播放
        }
      } else if (data.ttsFailed) {
        setPlayHint(true);
      }
    } catch {
      setPhase('error');
      setError('网络异常，语音翻译失败。');
    }
  }

  function cancel() {
    stopAll();
    setSec(0);
    setPhase('idle');
  }

  function playTranslation() {
    if (!result || !result.audioBase64) return;
    const au = audioRef.current || new Audio('data:audio/wav;base64,' + result.audioBase64);
    audioRef.current = au;
    au.play().catch(() => {});
  }

  function toggleAutoplay() {
    const next = !autoplay;
    setAutoplay(next);
    try { localStorage.setItem('aifanyi_autoplay', next ? '1' : '0'); } catch {}
  }

  return (
    <div className="voice-translate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {phase === 'idle' && (
        <button type="button" className="voice-btn" title="语音翻译（说话→自动翻译→朗读译文）" aria-label="语音翻译" disabled={disabled} onClick={startRecord}>🎙️</button>
      )}
      {phase === 'recording' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'voicePulse 1s infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>正在录音 {sec}s</span>
          <button type="button" style={{ padding: '3px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }} onClick={stopAndTranslate}>完成并翻译</button>
          <button type="button" style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }} onClick={cancel}>取消</button>
        </span>
      )}
      {phase === 'translating' && <span style={{ fontSize: 13, color: 'var(--muted)' }}>识别并翻译中…</span>}
      {phase === 'error' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
          <button type="button" className="voice-btn" title="重试" onClick={() => { setPhase('idle'); setError(''); }}>🎙️</button>
        </span>
      )}
      {phase === 'idle' && result && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoplay} onChange={toggleAutoplay} style={{ accentColor: 'var(--accent)' }} />
            自动播放译文
          </label>
          {playHint && result.audioBase64 && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>浏览器禁止自动播放，</span>
          )}
          {result.audioBase64 && (
            <button type="button" onClick={playTranslation} style={{ padding: '3px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }}>🔊 播放译文</button>
          )}
        </span>
      )}
      <style>{'@keyframes voicePulse{0%,100%{opacity:1}50%{opacity:.3}}'}</style>
    </div>
  );
}
