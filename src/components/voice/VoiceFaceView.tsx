'use client';

/** VoiceFaceView：横屏双端面对面模式（手机放两人中间）
 * 左半 A 区（正向朝向 A）/ 右半 B 区（rotate180 朝向 B），中间窄对话流
 * 各自大按钮 + 波形 + 最近结果；方向联动（A: zh→en ⇄ B: en→zh）
 */
import { useEffect, useRef } from 'react';
import { LANG_LABEL, useVoiceSession } from '@/lib/voice/useVoiceSession';
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
      const bars = 18;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = rms > 0.01 ? Math.max(0.08, Math.min(1, rms * (0.5 + Math.random() * 0.7))) : 0.05;
        const bh = v * (h - 4);
        ctx.fillStyle = active ? '#ef4444' : 'rgba(255,255,255,.4)';
        ctx.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [rms, active]);
  return <canvas ref={ref} width={180} height={30} style={{ width: '80%', height: 30, display: 'block', margin: '0 auto 8px' }} />;
}

function FaceSide({ session, side, accent, label }: { session: ReturnType<typeof useVoiceSession>; side: 'a' | 'b'; accent: string; label: string }) {
  const s = session;
  const busy = s.phase === 'TRANSCRIBING' || s.phase === 'TRANSLATING' || s.phase === 'SYNTHESIZING';
  const last = s.msgs[s.msgs.length - 1];
  const statusText =
    s.phase === 'RECORDING' ? '聆听中 ' + s.sec + 's' :
    s.phase === 'TRANSCRIBING' ? '识别中…' :
    s.phase === 'TRANSLATING' ? '翻译中…' :
    s.phase === 'SYNTHESIZING' ? '生成语音…' :
    s.phase === 'PLAYING' ? '播放中…' :
    s.phase === 'ERROR' ? s.error : (LANG_LABEL[s.direction.sourceLang] || s.direction.sourceLang) + ' → ' + (LANG_LABEL[s.direction.targetLang] || s.direction.targetLang);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: accent }}>{label}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
        {(LANG_LABEL[s.direction.sourceLang] || s.direction.sourceLang)} → {(LANG_LABEL[s.direction.targetLang] || s.direction.targetLang)}
      </div>
      <WaveCanvas rms={s.rms} active={s.phase === 'RECORDING'} />
      <button
        type="button"
        onClick={() => { if (s.phase === 'RECORDING' || busy) return; s.startListen(side); }}
        disabled={s.phase === 'RECORDING' || busy}
        style={{
          width: 76, height: 76, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: s.phase === 'RECORDING' ? '#ef4444' : accent,
          color: '#fff', fontSize: 30, boxShadow: '0 4px 16px rgba(0,0,0,.4)',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', opacity: busy ? 0.55 : 1,
        }}
        aria-label={label + ' 开始说话'}
      >
        {s.phase === 'RECORDING' ? '◼' : '🎙️'}
      </button>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', minHeight: 18, maxWidth: '92%' }}>{statusText}</div>
      {s.phase === 'ERROR' && (
        <button type="button" onClick={() => s.startListen(side)} style={{ padding: '4px 14px', fontSize: 13, borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>重试</button>
      )}
      {last && (
        <div style={{ width: '100%' }}>
          <MsgBubble msg={last} playing={s.playingId === last.id} onPlay={s.playMsg} onStop={s.stopPlay} dark />
        </div>
      )}
    </div>
  );
}

export default function VoiceFaceView() {
  const a = useVoiceSession('zh', 'en');
  const b = useVoiceSession('en', 'zh');
  const midRef = useRef<HTMLDivElement>(null);
  const all = [...a.msgs.map((m) => ({ ...m, t: 0 })), ...b.msgs.map((m) => ({ ...m, t: 1 }))].sort((x, y) => (x.time < y.time ? -1 : 1));

  useEffect(() => {
    if (midRef.current) midRef.current.scrollTop = midRef.current.scrollHeight;
  }, [all.length]);

  // 方向联动交换
  const faceSwap = () => { a.swapLang(); b.swapLang(); };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 61px)', background: '#0f172a', color: '#fff', overflow: 'hidden' }}>
      {/* A 区（左侧，正向） */}
      <div style={{ flex: 1, display: 'flex', borderRight: '1px solid rgba(255,255,255,.12)' }}>
        <FaceSide session={a} side="a" accent="#3b82f6" label="A 说话" />
      </div>
      {/* 中间对话流（窄） */}
      <div style={{ width: 168, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,.12)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', textAlign: 'center', padding: '6px 0' }}>对话</div>
        <button type="button" onClick={faceSwap} style={{ margin: '0 auto 4px', padding: '4px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,.25)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>⇄ 交换方向</button>
        <div ref={midRef} style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {all.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: 24 }}>对话记录</div>}
          {all.map((m: any, i: number) => (
            <div key={m.id} style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', background: m.side === 'a' ? 'rgba(59,130,246,.25)' : 'rgba(34,211,164,.25)', borderRadius: 8, padding: '4px 6px', marginBottom: 4 }}>
              <div>{m.text}</div>
              <div style={{ color: 'rgba(255,255,255,.5)' }}>{m.translation}</div>
            </div>
          ))}
        </div>
      </div>
      {/* B 区（右侧，rotate180 朝向 B） */}
      <div style={{ flex: 1, display: 'flex', transform: 'rotate(180deg)' }}>
        <FaceSide session={b} side="b" accent="#22d3a4" label="B 说话" />
      </div>
    </div>
  );
}
