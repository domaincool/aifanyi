'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 面对面语音翻译（V3）
 * 布局：上半 A 语言 / 下半 B 语言，双方各持一个 🎙️
 * 支持两种说话方式：按住说话（按住录音、松手翻译）/ 自动断句（点击开始，VAD 静音检测自动结束）
 * VAD：AnalyserNode 音量检测，静音持续 vadMs（可配置 600/1200/2000ms）自动断句，上限 30s 强制断句
 * 每句生成对话气泡（A 左 / B 右），含原文+译文+播放
 * 移动端：touch 按住说话、页面隐藏自动取消录音、权限拒绝/网络中断中文提示
 */

interface LangPair { code: string; label: string; }
const LANGS: LangPair[] = [
  { code: 'zh', label: '中文' }, { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' }, { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' }, { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' }, { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' }, { code: 'ar', label: 'العربية' },
];
const LANG_MAP: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l.code, l.label]));

interface Msg {
  id: string;
  side: 'a' | 'b';
  text: string;
  translation: string;
  audioBase64: string | null;
  ttsFailed: boolean;
  time: string;
}

type Phase = 'idle' | 'recording' | 'translating';

interface Side {
  sourceLang: string;
  targetLang: string;
}

const TARGET_SR = 16000;

function encodeWav(raw: Float32Array, sampleRate: number): Blob {
  const cleaned = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) { const s = raw[i]; cleaned[i] = Number.isFinite(s) ? s : 0; }
  let samples: Float32Array = cleaned;
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
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SR, true); view.setUint32(28, TARGET_SR * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeStr(36, 'data'); view.setUint32(40, samples.length * 2, true);
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
  autoMode: boolean;
}

export default function VoicePageClient() {
  const [sideA, setSideA] = useState<Side>({ sourceLang: 'zh', targetLang: 'en' });
  const [sideB, setSideB] = useState<Side>({ sourceLang: 'en', targetLang: 'zh' });
  const [autoMode, setAutoMode] = useState(false); // 全局：按住说话 / 自动断句
  const [vadMs, setVadMs] = useState(1200); // 静音断句阈值
  const [phaseA, setPhaseA] = useState<Phase>('idle');
  const [phaseB, setPhaseB] = useState<Phase>('idle');
  const [errA, setErrA] = useState('');
  const [errB, setErrB] = useState('');
  const [sec, setSec] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ side: 'a' | 'b'; rec: Rec } | null>(null);
  const timerRef = useRef<any>(null);
  const secRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pressingRef = useRef(false);

  // 滚动到底部
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  // 页面隐藏（后台切换）→ 取消录音
  useEffect(() => {
    const h = () => { if (document.hidden && recRef.current) cancelRec(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setSecSafe(n: number) { secRef.current = n; setSec(n); }

  async function startRec(side: 'a' | 'b') {
    const errSet = side === 'a' ? setErrA : setErrB;
    errSet('');
    if (recRef.current) cancelRec();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { errSet('当前浏览器不支持录音，请使用 Chrome / Safari。'); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e: any) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) errSet('麦克风权限被拒绝，请在浏览器设置中允许后重试。');
      else if (e && e.name === 'NotFoundError') errSet('未检测到麦克风设备。');
      else errSet('无法访问麦克风。');
      return;
    }
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      proc.onaudioprocess = (e) => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      source.connect(proc);
      proc.connect(ctx.destination);
      const rec: Rec = { ctx, source, proc, analyser, stream, chunks, start: Date.now(), silenceStart: null, autoMode };
      recRef.current = { side, rec };
      (side === 'a' ? setPhaseA : setPhaseB)('recording');
      setSecSafe(0);
      timerRef.current = setInterval(() => { setSecSafe(Math.round((Date.now() - rec.start) / 1000)); }, 500);
      // VAD 循环（自动模式）或仅计时（按住模式）
      if (autoMode) startVadLoop(rec, side);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      errSet('录音初始化失败，请重试。');
    }
  }

  function startVadLoop(rec: Rec, side: 'a' | 'b') {
    const data = new Uint8Array(rec.analyser.frequencyBinCount);
    const loop = () => {
      if (!recRef.current || recRef.current.rec !== rec) return;
      rec.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      const elapsed = (Date.now() - rec.start) / 1000;
      if (rms < 0.02) {
        if (rec.silenceStart === null) rec.silenceStart = Date.now();
        else if (Date.now() - rec.silenceStart >= vadMs) { stopAndTranslate(side); return; }
      } else {
        rec.silenceStart = null;
      }
      if (elapsed >= 30) { stopAndTranslate(side); return; } // 30s 上限强制断句
      setTimeout(loop, 100);
    };
    loop();
  }

  async function stopAndTranslate(side: 'a' | 'b') {
    const cur = recRef.current;
    if (!cur || cur.side !== side) return;
    const rec = cur.rec;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const durationSec = Math.max(1, Math.round((Date.now() - rec.start) / 1000));
    const total = rec.chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of rec.chunks) { merged.set(c, off); off += c.length; }
    // 关闭录音
    try { rec.proc.disconnect(); } catch {}
    try { rec.source.disconnect(); } catch {}
    try { rec.stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { rec.ctx.close(); } catch {}
    recRef.current = null;
    pressingRef.current = false;
    setSecSafe(0);
    const errSet = side === 'a' ? setErrA : setErrB;
    if (durationSec > 30) { errSet('单次录音限 30 秒，请分句录制。'); return; }
    if (total < 1600) { errSet('没有听到声音，请再说一次。'); return; }
    (side === 'a' ? setPhaseA : setPhaseB)('translating');
    const lang = side === 'a' ? sideA : sideB;
    try {
      const wav = encodeWav(merged, rec.ctx.sampleRate);
      const fd = new FormData();
      fd.append('file', wav, 'rec.wav');
      fd.append('mime', 'audio/wav');
      fd.append('duration', String(durationSec));
      fd.append('sourceLang', lang.sourceLang);
      fd.append('targetLang', lang.targetLang);
      const res = await fetch('/api/voice/translate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) {
        (side === 'a' ? setPhaseA : setPhaseB)('idle');
        errSet(data.error || '语音翻译失败，请重试。');
        if (res.status === 401) window.dispatchEvent(new CustomEvent('open-login-modal'));
        return;
      }
      (side === 'a' ? setPhaseA : setPhaseB)('idle');
      const now = new Date();
      const msg: Msg = {
        id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
        side,
        text: data.text,
        translation: data.translation,
        audioBase64: data.audioBase64 || null,
        ttsFailed: !!data.ttsFailed,
        time: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'),
      };
      setMsgs((m) => [...m, msg]);
      if (data.audioBase64) playAudio(msg);
    } catch {
      (side === 'a' ? setPhaseA : setPhaseB)('idle');
      errSet('网络异常，语音翻译失败，请重试。');
    }
  }

  function cancelRec() {
    const cur = recRef.current;
    if (!cur) return;
    try { cur.rec.proc.disconnect(); } catch {}
    try { cur.rec.source.disconnect(); } catch {}
    try { cur.rec.stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { cur.rec.ctx.close(); } catch {}
    recRef.current = null;
    pressingRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSecSafe(0);
    (cur.side === 'a' ? setPhaseA : setPhaseB)('idle');
  }

  function playAudio(msg: Msg) {
    if (!msg.audioBase64) return;
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    const au = new Audio('data:audio/wav;base64,' + msg.audioBase64);
    audioRef.current = au;
    setPlayingId(msg.id);
    au.onended = () => setPlayingId(null);
    au.onerror = () => setPlayingId(null);
    au.play().catch(() => setPlayingId(null));
  }

  // 按住说话（touch/mouse）
  function pressStart(side: 'a' | 'b', e: React.PointerEvent) {
    e.preventDefault();
    if (pressingRef.current) return;
    pressingRef.current = true;
    startRec(side);
  }
  function pressEnd(side: 'a' | 'b') {
    if (!pressingRef.current) return;
    pressingRef.current = false;
    if (recRef.current && recRef.current.side === side && recRef.current.rec.autoMode === false) {
      stopAndTranslate(side);
    }
  }

  function switchMode(next: boolean) {
    setAutoMode(next);
    if (recRef.current) cancelRec();
  }

  const isRecA = phaseA === 'recording';
  const isRecB = phaseB === 'recording';

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 48px' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>面对面语音翻译</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 16px' }}>
        一人说一句，自动识别并翻译。适合中英文（或任意语言）双人交流。
      </p>

      {/* 模式设置 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--panel)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => switchMode(false)} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: !autoMode ? 'var(--accent)' : 'var(--input-bg)', color: !autoMode ? '#fff' : 'var(--text)', cursor: 'pointer' }}>按住说话</button>
          <button type="button" onClick={() => switchMode(true)} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: autoMode ? 'var(--accent)' : 'var(--input-bg)', color: autoMode ? '#fff' : 'var(--text)', cursor: 'pointer' }}>自动断句</button>
        </div>
        {autoMode && (
          <label style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            静音多久算说完：
            <select value={vadMs} onChange={(e) => setVadMs(parseInt(e.target.value, 10))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}>
              <option value={600}>0.6 秒（灵敏）</option>
              <option value={1200}>1.2 秒（推荐）</option>
              <option value={2000}>2 秒（宽松）</option>
            </select>
          </label>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>自动播放译文：{''}
          <label style={{ cursor: 'pointer' }}><input type="checkbox" defaultChecked onChange={(e) => { try { localStorage.setItem('aifanyi_autoplay', e.target.checked ? '1' : '0'); } catch {} }} style={{ accentColor: 'var(--accent)' }} /> 开</label>
        </span>
      </div>

      {/* 对话流 */}
      <div ref={listRef} style={{ minHeight: 180, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 16, background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>对话记录会显示在这里，开始说话吧 🎙️</div>}
        {msgs.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: m.side === 'a' ? 'row' : 'row-reverse' }}>
            <div style={{ maxWidth: '85%', background: m.side === 'a' ? 'rgba(37,99,235,.12)' : 'rgba(34,211,164,.12)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{m.side === 'a' ? 'A · ' + (LANG_MAP[sideA.sourceLang] || sideA.sourceLang) : 'B · ' + (LANG_MAP[sideB.sourceLang] || sideB.sourceLang)} · {m.time}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.text}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>{m.translation}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                {m.audioBase64 && (
                  <button type="button" onClick={() => playAudio(m)} style={{ padding: '2px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }}>
                    {playingId === m.id ? '⏸ 播放中…' : '🔊 播放译文'}
                  </button>
                )}
                {m.ttsFailed && <span style={{ fontSize: 12, color: 'var(--muted)' }}>（语音合成失败，已显示文字）</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* A 栏（上半） */}
      <VoicePanel
        title="A 说话"
        accent="#2563eb"
        lang={sideA}
        onLang={(s: Side) => setSideA(s)}
        phase={phaseA}
        err={errA}
        sec={sec}
        isRec={isRecA}
        autoMode={autoMode}
        onPressStart={(e) => pressStart('a', e)}
        onPressEnd={() => pressEnd('a')}
        onAutoStart={() => startRec('a')}
        onCancel={cancelRec}
      />

      {/* B 栏（下半） */}
      <VoicePanel
        title="B 说话"
        accent="#22d3a4"
        lang={sideB}
        onLang={(s: Side) => setSideB(s)}
        phase={phaseB}
        err={errB}
        sec={sec}
        isRec={isRecB}
        autoMode={autoMode}
        onPressStart={(e) => pressStart('b', e)}
        onPressEnd={() => pressEnd('b')}
        onAutoStart={() => startRec('b')}
        onCancel={cancelRec}
      />

      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 16, textAlign: 'center' }}>
        录音仅用于本次翻译，不会保存。语音翻译需登录使用，额度透明可查。
      </p>
    </main>
  );
}

/* ============ 语音面板（A/B 各一） ============ */
function VoicePanel(props: {
  title: string; accent: string; lang: Side;
  onLang: (s: Side) => void;
  phase: Phase; err: string; sec: number; isRec: boolean; autoMode: boolean;
  onPressStart: (e: React.PointerEvent) => void; onPressEnd: () => void;
  onAutoStart: () => void; onCancel: () => void;
}) {
  const { title, accent, lang, onLang, phase, err, sec, isRec, autoMode, onPressStart, onPressEnd, onAutoStart, onCancel } = props;
  const langs = LANGS;
  const selectStyle = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13 };
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12, background: 'var(--panel)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: accent, minWidth: 60 }}>{title}</span>
        <select value={lang.sourceLang} onChange={(e) => onLang({ ...lang, sourceLang: e.target.value })} style={selectStyle} aria-label="源语言">
          {langs.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>→</span>
        <select value={lang.targetLang} onChange={(e) => onLang({ ...lang, targetLang: e.target.value })} style={selectStyle} aria-label="目标语言">
          {langs.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>

      {phase === 'idle' && (
        <button
          type="button"
          onPointerDown={autoMode ? undefined : onPressStart}
          onPointerUp={autoMode ? undefined : onPressEnd}
          onPointerLeave={autoMode ? undefined : onPressEnd}
          onPointerCancel={autoMode ? undefined : onPressEnd}
          onClick={autoMode ? onAutoStart : undefined}
          style={{
            width: '100%', padding: '18px 0', fontSize: 16, borderRadius: 12, cursor: 'pointer', touchAction: 'none',
            border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {autoMode ? '🎙️ 点击开始（说完自动停止）' : '🎙️ 按住说话（松手翻译）'}
        </button>
      )}
      {phase === 'recording' && (
        <div style={{ textAlign: 'center', padding: '18px 0' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444', marginRight: 8, animation: 'voicePulse 1s infinite' }} />
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>正在录音 {sec}s</span>
          {autoMode && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>说完停顿片刻会自动翻译</div>}
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={onCancel} style={{ padding: '4px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--muted)', cursor: 'pointer' }}>取消</button>
          </div>
        </div>
      )}
      {phase === 'translating' && (
        <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--muted)' }}>识别并翻译中…</div>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{err}</div>}
      <style>{'@keyframes voicePulse{0%,100%{opacity:1}50%{opacity:.3}}'}</style>
    </div>
  );
}

