'use client';

/** VoiceDesktopView：桌面双面板面对面（≥1024px）
 * A/B 各带方向 + 波形 + 大按钮 + 分段状态；下方共享对话流（MsgBubble）+ 清空 + 积分
 */
import { useEffect, useRef } from 'react';
import { LANG_LABEL, LANGS, useVoiceSession } from '@/lib/voice/useVoiceSession';
import MsgBubble from './MsgBubble';

function WaveCanvas({ rms, active }: { rms: number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      const bars = 28;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = rms > 0.01 ? Math.max(0.08, Math.min(1, rms * (0.5 + Math.random() * 0.7))) : 0.05;
        const bh = v * (h - 4);
        ctx.fillStyle = active ? '#ef4444' : 'rgba(148,163,184,.5)';
        ctx.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [rms, active]);
  return <canvas ref={ref} width={300} height={36} style={{ width: '100%', height: 36, display: 'block' }} />;
}

function Panel({ session, side, accent, label }: { session: ReturnType<typeof useVoiceSession>; side: 'a' | 'b'; accent: string; label: string }) {
  const s = session;
  const busy = s.phase === 'TRANSCRIBING' || s.phase === 'TRANSLATING' || s.phase === 'SYNTHESIZING';
  const statusText =
    s.phase === 'RECORDING' ? '聆听中 ' + s.sec + 's' :
    s.phase === 'TRANSCRIBING' ? '识别中…' :
    s.phase === 'TRANSLATING' ? '翻译中…' :
    s.phase === 'SYNTHESIZING' ? '生成语音…' :
    s.phase === 'PLAYING' ? '播放中…' :
    s.phase === 'ERROR' ? s.error : '点按开始 · 说完自动翻译';
  const selStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14 };

  return (
    <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 14, padding: 16, background: 'var(--panel)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>{label}</span>
        <select value={s.direction.sourceLang} onChange={(e) => s.setDirection(e.target.value, s.direction.targetLang)} style={selStyle} aria-label="源语言">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <span style={{ color: 'var(--muted)' }}>→</span>
        <select value={s.direction.targetLang} onChange={(e) => s.setDirection(s.direction.sourceLang, e.target.value)} style={selStyle} aria-label="目标语言">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button type="button" onClick={s.swapLang} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }}>⇄ 交换</button>
      </div>
      <WaveCanvas rms={s.rms} active={s.phase === 'RECORDING'} />
      <button
        type="button"
        className="voice-record-btn"
        onPointerDown={(e) => { if (s.phase === 'RECORDING' || busy) return; if (s.holdMode) { s.pressStart(side, e); } else { s.startListen(side); } }}
        onPointerUp={() => { if (s.holdMode) s.pressEnd(); }}
        onPointerCancel={() => { if (s.holdMode) s.pressEnd(); }}
        onContextMenu={(e) => e.preventDefault()}
        
        style={{
          width: '100%', padding: '20px 0', fontSize: 17, borderRadius: 12, cursor: 'pointer',
          border: 'none', background: s.phase === 'RECORDING' ? '#ef4444' : accent, color: '#fff', fontWeight: 600,
          opacity: busy ? 0.55 : 1, touchAction: 'manipulation',
        }}
      >
        {s.phase === 'RECORDING' ? '◼ 正在录音 ' + s.sec + 's' : '🎙️ 点按开始（说完自动翻译）'}
      </button>
      <div style={{ fontSize: 13, color: s.phase === 'ERROR' ? 'var(--danger)' : 'var(--muted)', marginTop: 8, minHeight: 20, textAlign: 'center' }}>
        {statusText}
        {s.phase === 'ERROR' && (
          <button type="button" onClick={() => s.startListen(side)} style={{ marginLeft: 8, padding: '2px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }}>重试</button>
        )}
      </div>
      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer' }}>
        <input type="checkbox" checked={s.holdMode} onChange={(e) => { s.setHoldMode(e.target.checked); if (e.target.checked) s.cancelListen(); }} style={{ accentColor: 'var(--accent)' }} />
        按住说话（备用）
      </label>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>免费使用 · 无需付费</div>
    </div>
  );
}

export default function VoiceDesktopView() {
  const a = useVoiceSession('zh', 'en');
  const b = useVoiceSession('en', 'zh');
  const listRef = useRef<HTMLDivElement>(null);
  const all = [...a.msgs.map((m) => ({ ...m, ord: a.msgs.indexOf(m) })), ...b.msgs.map((m) => ({ ...m, ord: b.msgs.indexOf(m) }))]
    .sort((x, y) => (x.time < y.time ? -1 : x.time > y.time ? 1 : x.ord - y.ord));

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [all.length]);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 16px 40px' }}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <Panel session={a} side="a" accent="#2563eb" label="A 说话" />
        <Panel session={b} side="b" accent="#0d9488" label="B 说话" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>对话记录</h2>
        {all.length > 0 && (
          <button type="button" onClick={() => { a.clearAll(); b.clearAll(); }} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
            🗑 清空本次对话（{all.length} 条）
          </button>
        )}
      </div>
      <div ref={listRef} style={{ minHeight: 120, maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--panel)' }}>
        {all.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 32 }}>对话记录会显示在这里。桌面端支持 A/B 双方同时使用。</div>}
        {all.map((m: any) => (
          <MsgBubble key={m.id} msg={m} playing={a.playingId === m.id || b.playingId === m.id} onPlay={(mm) => (mm.side === 'a' ? a.playMsg(mm) : b.playMsg(mm))} onStop={() => { a.stopPlay(); b.stopPlay(); }} />
        ))}
      </div>
    </div>
  );
}
