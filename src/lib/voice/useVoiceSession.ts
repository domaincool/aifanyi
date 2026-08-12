'use client';

/**
 * useVoiceSession：/voice 核心状态机（UI 无关）
 * 状态：IDLE → RECORDING → TRANSCRIBING → TRANSLATING → SYNTHESIZING → PLAYING → COMPLETED → ERROR
 * 录音：AnalyserNode 音量（波形）+ ScriptProcessor 采集 + VAD 自动断句（标准/安静/嘈杂）
 * 处理：/api/voice/translate?stream=1 SSE 真实阶段事件
 * 额度：预计（服务端 estimate） + 本次（usedCredits），用户只见「额度」一词
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoicePhase = 'IDLE' | 'RECORDING' | 'TRANSCRIBING' | 'TRANSLATING' | 'SYNTHESIZING' | 'PLAYING' | 'COMPLETED' | 'ERROR';

export interface VoiceMsg {
  id: string;
  side: 'a' | 'b';
  sourceLang: string;
  targetLang: string;
  text: string;
  translation: string;
  audioBase64: string | null;
  ttsFailed: boolean;
  usedCredits: number;
  autoplayBlocked: boolean;
  time: string;
}

export type VadLevel = 'standard' | 'quiet' | 'noisy';

const VAD_MS: Record<VadLevel, number> = { standard: 1200, quiet: 2000, noisy: 600 };
const TARGET_SR = 16000;
const MAX_SEC = 30;
const MIN_PRESS_MS = 250;
const MIN_SAMPLES = 1600; // 0.1s @16k

export const LANGS: { code: string; label: string }[] = [
  { code: 'zh', label: '中文' }, { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' }, { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' }, { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' }, { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' }, { code: 'ar', label: 'العربية' },
];
export const LANG_LABEL: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l.code, l.label]));

function encodeWav(raw: Float32Array, sampleRate: number): Blob {
  const cleaned = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) { const s = raw[i]; cleaned[i] = Number.isFinite(s) ? s : 0; }
  let samples = cleaned;
  if (sampleRate !== TARGET_SR && sampleRate > 0) {
    const outLen = Math.max(1, Math.round((cleaned.length * TARGET_SR) / sampleRate));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const p = (i * sampleRate) / TARGET_SR;
      const i0 = Math.floor(p); const i1 = Math.min(i0 + 1, cleaned.length - 1); const f = p - i0;
      out[i] = cleaned[i0] * (1 - f) + cleaned[i1] * f;
    }
    samples = out;
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SR, true); view.setUint32(28, TARGET_SR * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ws(36, 'data'); view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

interface Rec {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  proc: ScriptProcessorNode;
  analyser: AnalyserNode;
  stream: MediaStream;
  chunks: Float32Array[];
  start: number;
  silenceStart: number | null;
}

export function useVoiceSession(initialSource = 'zh', initialTarget = 'en') {
  const [phase, setPhase] = useState<VoicePhase>('IDLE');
  const [error, setError] = useState('');
  const [sec, setSec] = useState(0);
  const [rms, setRms] = useState(0); // 实时音量 0..1（波形）
  const [msgs, setMsgs] = useState<VoiceMsg[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [direction, setDirection] = useState({ sourceLang: initialSource, targetLang: initialTarget });
  const [vadLevel, setVadLevelState] = useState<VadLevel>('standard');
  const [recentLangs, setRecentLangs] = useState<string[]>([]);
  const [estCredits, setEstCredits] = useState<number | null>(null); // 预计额度
  const [lastUsed, setLastUsed] = useState<number | null>(null); // 本次使用额度
  const [holdMode, setHoldMode] = useState(false); // 按住说话（备用模式）

  const recRef = useRef<Rec | null>(null);
  const timerRef = useRef<any>(null);
  const vadTimerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sideRef = useRef<'a' | 'b'>('a'); // 当前录音归属侧（A=当前方向；交换后新方向仍是 A 侧？用交替逻辑见下）
  const pressTimeRef = useRef(0);
  const pressingRef = useRef(false);
  const secRef = useRef(0);
  const phaseRef = useRef<VoicePhase>('IDLE');
  phaseRef.current = phase;

  const setSecSafe = (n: number) => { secRef.current = n; setSec(n); };
  const setPhaseSafe = (p: VoicePhase) => { phaseRef.current = p; setPhase(p); };

  /* ---------- 最近使用语言 ---------- */
  useEffect(() => {
    try {
      const v = localStorage.getItem('aifanyi_recent_langs');
      if (v) setRecentLangs(JSON.parse(v));
    } catch {}
  }, []);

  const rememberLang = (s: string, t: string) => {
    const key = s + ':' + t;
    const next = [key, ...recentLangs.filter((k) => k !== key)].slice(0, 5);
    setRecentLangs(next);
    try { localStorage.setItem('aifanyi_recent_langs', JSON.stringify(next)); } catch {}
  };

  /* ---------- 预计额度（服务端算价） ---------- */
  useEffect(() => {
    let dead = false;
    fetch('/api/credit/estimate?feature=voice&seconds=15')
      .then((r) => r.json())
      .then((d) => { if (!dead && typeof d.credits === 'number') setEstCredits(d.credits); })
      .catch(() => {});
    return () => { dead = true; };
  }, []);

  /* ---------- 播放 ---------- */
  const playMsg = useCallback((msg: VoiceMsg) => {
    if (!msg.audioBase64) return;
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    const au = new Audio('data:audio/wav;base64,' + msg.audioBase64);
    audioRef.current = au;
    setPlayingId(msg.id);
    setPhaseSafe('PLAYING');
    au.onended = () => { setPlayingId(null); setPhaseSafe('COMPLETED'); };
    au.onerror = () => { setPlayingId(null); setPhaseSafe('COMPLETED'); };
    au.play().then(() => {}).catch(() => {
      // 自动播放被拦：显式 fallback（气泡内展示「点击播放」）
      setPlayingId(null);
      setPhaseSafe('COMPLETED');
      setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...x, autoplayBlocked: true } : x)));
    });
  }, []);

  const stopPlay = useCallback(() => {
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    setPlayingId(null);
    setPhaseSafe('COMPLETED');
  }, []);

  /* ---------- 录音 ---------- */
  const cleanupRec = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try { rec.proc.disconnect(); } catch {}
      try { rec.source.disconnect(); } catch {}
      try { rec.stream.getTracks().forEach((t) => t.stop()); } catch {}
      try { rec.ctx.close(); } catch {}
    }
    recRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (vadTimerRef.current) { clearTimeout(vadTimerRef.current); vadTimerRef.current = null; }
    setSecSafe(0);
    setRms(0);
  }, []);

  const cancelListen = useCallback(() => {
    cleanupRec();
    pressingRef.current = false;
    setPhaseSafe('IDLE');
  }, [cleanupRec]);

  /* ---------- SSE 翻译流水线 ---------- */
  const runPipeline = useCallback(async (wav: Blob, durationSec: number, sourceLang: string, targetLang: string, side: 'a' | 'b') => {
    const fd = new FormData();
    fd.append('file', wav, 'rec.wav');
    fd.append('mime', 'audio/wav');
    fd.append('duration', String(durationSec));
    fd.append('sourceLang', sourceLang);
    fd.append('targetLang', targetLang);
    try {
      const res = await fetch('/api/voice/translate?stream=1', { method: 'POST', body: fd });
      if (res.status === 401) {
        setPhaseSafe('ERROR'); setError('请先登录后再使用。');
        window.dispatchEvent(new CustomEvent('open-login-modal'));
        return;
      }
      if (res.status === 402) {
        const d = await res.json().catch(() => ({}));
        setPhaseSafe('ERROR'); setError((d && d.error) || '额度不足，请先补充额度。');
        return;
      }
      if (res.status === 429) {
        setPhaseSafe('ERROR'); setError('操作太频繁，请稍等片刻再试。');
        return;
      }
      if (!res.ok || !res.body) {
        setPhaseSafe('ERROR'); setError('语音翻译失败，请重试。');
        return;
      }
      // SSE 解析
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let result: any = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          let ev: any;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          if (ev.type === 'status') {
            if (ev.state === 'TRANSCRIBING') { setPhaseSafe('TRANSCRIBING'); setError(''); }
            else if (ev.state === 'TRANSLATING') setPhaseSafe('TRANSLATING');
            else if (ev.state === 'SYNTHESIZING') setPhaseSafe('SYNTHESIZING');
          } else if (ev.type === 'result') {
            result = ev;
          }
        }
      }
      if (!result) { setPhaseSafe('ERROR'); setError('语音翻译失败，请重试。'); return; }
      if (!result.ok) {
        setPhaseSafe('ERROR');
        if (result.status === 402) setError('额度不足，请先补充额度。');
        else if (result.status === 429) setError('操作太频繁，请稍等片刻再试。');
        else setError(result.error || '语音翻译失败，请重试。');
        return;
      }
      // 成功：入列 + 自动播放
      const now = new Date();
      const msg: VoiceMsg = {
        id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
        side,
        sourceLang,
        targetLang,
        text: result.text || '',
        translation: result.translation || '',
        audioBase64: result.audioBase64 || null,
        ttsFailed: !!result.ttsFailed,
        usedCredits: typeof result.usedCredits === 'number' ? result.usedCredits : 0,
        autoplayBlocked: false,
        time: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'),
      };
      setMsgs((m) => [...m, msg]);
      setLastUsed(msg.usedCredits);
      setPhaseSafe('COMPLETED');
      let autoplay = true;
      try { autoplay = localStorage.getItem('aifanyi_autoplay') !== '0'; } catch {}
      if (autoplay && msg.audioBase64 && !msg.ttsFailed) {
        // 延迟一小段让 UI 先呈现气泡
        setTimeout(() => playMsg(msg), 150);
      }
    } catch {
      setPhaseSafe('ERROR');
      setError('网络异常，请检查网络后重试。');
    }
  }, [playMsg]);

  /* ---------- 停止录音并提交 ---------- */
  const submitListen = useCallback(async (side: 'a' | 'b') => {
    const rec = recRef.current;
    if (!rec) return;
    cleanupRec();
    const durationSec = Math.max(1, Math.round((Date.now() - rec.start) / 1000));
    const total = rec.chunks.reduce((n, c) => n + c.length, 0);
    if (durationSec > MAX_SEC) { setPhaseSafe('IDLE'); setError('已到 30 秒上限，请分句再说。'); return; }
    if (total < MIN_SAMPLES) { setPhaseSafe('IDLE'); setError('没有听到声音，请再说一次。'); return; }
    setPhaseSafe('TRANSCRIBING');
    setError('');
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of rec.chunks) { merged.set(c, off); off += c.length; }
    const wav = encodeWav(merged, rec.ctx.sampleRate);
    const d = direction;
    rememberLang(d.sourceLang, d.targetLang);
    await runPipeline(wav, durationSec, d.sourceLang, d.targetLang, side);
  }, [cleanupRec, direction, rememberLang, runPipeline]);

  /* ---------- 开始聆听 ---------- */
  const startListen = useCallback(async (side: 'a' | 'b') => {
    setError('');
    if (recRef.current) cancelListen();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setPhaseSafe('ERROR'); setError('当前浏览器不支持录音，请使用 Chrome / Safari。'); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e: any) {
      pressingRef.current = false;
      if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) setError('麦克风权限被拒绝。请在浏览器设置中允许，iOS 请在 设置→Safari→麦克风 中开启。');
      else if (e && e.name === 'NotFoundError') setError('未检测到麦克风设备。');
      else setError('无法访问麦克风。');
      setPhaseSafe('ERROR');
      return;
    }
    // 按住模式误触守卫（自动断句模式无长按语义）
    if (holdMode && (!pressingRef.current || Date.now() - pressTimeRef.current < MIN_PRESS_MS)) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    try {
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      proc.onaudioprocess = (e) => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      source.connect(proc);
      proc.connect(ctx.destination);
      recRef.current = { ctx, source, proc, analyser, stream, chunks, start: Date.now(), silenceStart: null };
      sideRef.current = side;
      setPhaseSafe('RECORDING');
      setSecSafe(0);
      timerRef.current = setInterval(() => {
        const el = Math.round((Date.now() - recRef.current!.start) / 1000);
        setSecSafe(el);
        if (!holdMode && el >= MAX_SEC) submitListen(sideRef.current);
      }, 500);
      // 波形（音量）循环：80ms 节流更新（12.5fps，避免每帧重渲染）
      const waveData = new Uint8Array(analyser.frequencyBinCount);
      let lastRmsAt = 0;
      const waveLoop = () => {
        if (!recRef.current || recRef.current.analyser !== analyser) return;
        analyser.getByteTimeDomainData(waveData);
        let sum = 0;
        for (let i = 0; i < waveData.length; i++) { const v = (waveData[i] - 128) / 128; sum += v * v; }
        const r = Math.min(1, Math.sqrt(sum / waveData.length) * 3.2);
        if (Date.now() - lastRmsAt >= 80) { lastRmsAt = Date.now(); setRms(r); }
        requestAnimationFrame(waveLoop);
      };
      waveLoop();
      // VAD 自动断句（自动模式）
      if (!holdMode) {
        const vadMs = VAD_MS[vadLevel];
        const vadLoop = () => {
          const rec = recRef.current;
          if (!rec || rec.analyser !== analyser) return;
          analyser.getByteTimeDomainData(waveData);
          let sum = 0;
          for (let i = 0; i < waveData.length; i++) { const v = (waveData[i] - 128) / 128; sum += v * v; }
          const r = Math.sqrt(sum / waveData.length);
          if (r < 0.02) {
            if (rec.silenceStart === null) rec.silenceStart = Date.now();
            else if (Date.now() - rec.silenceStart >= vadMs) { submitListen(sideRef.current); return; }
          } else {
            rec.silenceStart = null;
          }
          if (Date.now() - rec.start >= MAX_SEC * 1000) { submitListen(sideRef.current); return; }
          vadTimerRef.current = setTimeout(vadLoop, 100);
        };
        vadLoop();
      }
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      pressingRef.current = false;
      setPhaseSafe('ERROR');
      setError('录音初始化失败，请重试。');
    }
  }, [cancelListen, holdMode, submitListen, vadLevel]);

  /* ---------- 按住说话（备用模式） ---------- */
  const pressStart = useCallback((side: 'a' | 'b', e: React.PointerEvent) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (pressingRef.current) return;
    pressingRef.current = true;
    pressTimeRef.current = Date.now();
    startListen(side);
  }, [startListen]);

  const pressEnd = useCallback(() => {
    if (!pressingRef.current) return;
    pressingRef.current = false;
    if (recRef.current) {
      if (Date.now() - pressTimeRef.current < MIN_PRESS_MS) cancelListen();
      else submitListen(sideRef.current);
    }
  }, [cancelListen, submitListen]);

  /* ---------- 按住模式：document 级松手兜底（手指滑出按钮/取消按钮豁免） ---------- */
  useEffect(() => {
    const up = () => { if (pressingRef.current) pressEnd(); };
    const down = (e: PointerEvent) => {
      // 点按「取消」时不触发松手提交（voice-cancel 豁免）
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('.voice-cancel')) { pressingRef.current = false; return; }
    };
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    document.addEventListener('touchend', up);
    document.addEventListener('touchcancel', up);
    document.addEventListener('pointerdown', down);
    return () => {
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('touchend', up);
      document.removeEventListener('touchcancel', up);
      document.removeEventListener('pointerdown', down);
    };
  }, [pressEnd]);

  /* ---------- 切后台 / 来电 / 锁屏 ---------- */
  useEffect(() => {
    const onHide = () => { if (document.hidden && recRef.current) cancelListen(); };
    const onCtx = () => {
      const rec = recRef.current;
      if (rec && rec.ctx.state === 'suspended') { cancelListen(); setError('录音已取消（设备中断）。'); }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('offline', () => { if (phaseRef.current === 'RECORDING') cancelListen(); });
    document.addEventListener('online', () => {});
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('offline', () => {});
      cleanupRec();
    };
  }, [cancelListen, cleanupRec]);

  /* ---------- 交换语言 ---------- */
  const swapLang = useCallback(() => {
    setDirection((d) => {
      const nd = { sourceLang: d.targetLang, targetLang: d.sourceLang };
      rememberLang(nd.sourceLang, nd.targetLang);
      return nd;
    });
  }, [rememberLang]);

  const setDirectionSafe = useCallback((s: string, t: string) => {
    setDirection({ sourceLang: s, targetLang: t });
    rememberLang(s, t);
  }, [rememberLang]);

  /* ---------- 清空本次对话 ---------- */
  const clearAll = useCallback(() => {
    stopPlay();
    setMsgs([]);
    setLastUsed(null);
    setError('');
  }, [stopPlay]);

  return {
    phase, error, sec, rms, msgs, playingId, direction, vadLevel, recentLangs, estCredits, lastUsed, holdMode,
    startListen, cancelListen, submitListen, pressStart, pressEnd, playMsg, stopPlay,
    swapLang, setDirection: setDirectionSafe, setVadLevel: setVadLevelState, setHoldMode,
    clearAll, LANG_LABEL,
  };
}
