'use client';

/** VoiceMobileView：竖屏单手模式
 * 方向条（A↔B 交换 + 最近语言 + 齿轮 VAD）+ 对话流 + 底部固定大录音按钮（safe-area）
 */
import { useEffect, useRef } from 'react';
import { LANGS, LANG_LABEL, useVoiceSession } from '@/lib/voice/useVoiceSession';
import MsgBubble from './MsgBubble';

export default function VoiceMobileView() {
  const s = useVoiceSession('zh', 'en');
  const listRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [s.msgs]);

  // 波形绘制
  useEffect(() => {
    const cv = waveRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      const bars = 24;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = s.rms > 0.01 ? Math.max(0.08, Math.min(1, s.rms * (0.5 + Math.random() * 0.7))) : 0.05;
        const bh = v * (h - 6);
        ctx.fillStyle = s.phase === 'RECORDING' ? '#ef4444' : 'rgba(148,163,184,.5)';
        ctx.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [s.phase, s.rms]);

  const busy = s.phase === 'TRANSCRIBING' || s.phase === 'TRANSLATING' || s.phase === 'SYNTHESIZING';
  const statusText =
    s.phase === 'RECORDING' ? '聆听中 ' + s.sec + 's · 停顿片刻自动翻译' :
    s.phase === 'TRANSCRIBING' ? '识别中…' :
    s.phase === 'TRANSLATING' ? '翻译中…' :
    s.phase === 'SYNTHESIZING' ? '生成语音…' :
    s.phase === 'PLAYING' ? '播放中…' :
    s.phase === 'ERROR' ? s.error : '点按开始 · 说完自动翻译';

  const selStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 15, maxWidth: 110 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 61px)', maxWidth: 640, margin: '0 auto', padding: '0 12px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* ① 方向条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', flexShrink: 0 }}>
        <select value={s.direction.sourceLang} onChange={(e) => s.setDirection(e.target.value, s.direction.targetLang)} style={selStyle} aria-label="源语言">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button
          type="button"
          onClick={s.swapLang}
          style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}
          aria-label="交换语言方向"
        >⇄</button>
        <select value={s.direction.targetLang} onChange={(e) => s.setDirection(s.direction.sourceLang, e.target.value)} style={selStyle} aria-label="目标语言">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(LANG_LABEL[s.direction.sourceLang] || s.direction.sourceLang)} → {(LANG_LABEL[s.direction.targetLang] || s.direction.targetLang)}
        </span>
        {/* 齿轮：VAD 环境设置（用户语言：标准/安静/嘈杂） */}
        <select
          value={s.vadLevel}
          onChange={(e) => s.setVadLevel(e.target.value as any)}
          aria-label="聆听灵敏度"
          title="聆听灵敏度"
          style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, flexShrink: 0 }}
        >
          <option value="standard">⚙️ 标准</option>
          <option value="quiet">🤫 安静环境</option>
          <option value="noisy">🔊 嘈杂环境</option>
        </select>
      </div>

      {/* 最近使用语言 */}
      {s.recentLangs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, overflowX: 'auto', paddingBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>最近：</span>
          {s.recentLangs.map((k) => {
            const [sl, tl] = k.split(':');
            return (
              <button key={k} type="button" onClick={() => s.setDirection(sl, tl)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {(LANG_LABEL[sl] || sl)}→{(LANG_LABEL[tl] || tl)}
              </button>
            );
          })}
        </div>
      )}

      {/* ② 对话流 */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 2px', minHeight: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          {s.msgs.length > 0 && (
            <button type="button" onClick={s.clearAll} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
              🗑 清空本次对话（{s.msgs.length} 条）
            </button>
          )}
        </div>
        {s.msgs.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '48px 12px' }}>
            点按下方按钮开始说话，说完自动翻译。<br />手机放两人中间，可横屏进入面对面模式。
          </div>
        )}
        {s.msgs.map((m) => (
          <MsgBubble key={m.id} msg={m} playing={s.playingId === m.id} onPlay={s.playMsg} onStop={s.stopPlay} />
        ))}
        {s.lastUsed !== null && s.msgs.length > 0 && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', padding: '2px 0 6px' }}>本次使用 {s.lastUsed} 个额度</div>
        )}
      </div>

      {/* ③ 底部操作区 */}
      <div style={{ flexShrink: 0, padding: '8px 0 calc(14px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
          {s.estCredits !== null ? '预计使用约 ' + s.estCredits + ' 个额度 / 次' : '额度透明 · 登录即享'}
        </div>
        <canvas ref={waveRef} width={200} height={34} style={{ width: '70%', height: 34, display: 'block', margin: '0 auto 6px' }} />
        <button
          type="button"
          className="voice-record-btn"
        onPointerDown={(e) => { if (s.phase === 'RECORDING' || busy) return; if (s.holdMode) { s.pressStart('a', e); } else { s.startListen('a'); } }}
        onPointerUp={() => { if (s.holdMode) s.pressEnd(); }}
        onPointerCancel={() => { if (s.holdMode) s.pressEnd(); }}
        onContextMenu={(e) => e.preventDefault()}
          
          style={{
            width: 84, height: 84, borderRadius: '50%', cursor: 'pointer', border: 'none',
            background: s.phase === 'RECORDING' ? '#ef4444' : 'var(--accent)',
            color: '#fff', fontSize: 34, boxShadow: '0 6px 20px rgba(37,99,235,.35)',
            touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            opacity: busy ? 0.55 : 1,
          }}
          aria-label="开始语音翻译"
        >
          {s.phase === 'RECORDING' ? '◼' : '🎙️'}
        </button>
        <div style={{ fontSize: 13, color: s.phase === 'ERROR' ? 'var(--danger)' : 'var(--muted)', marginTop: 8, minHeight: 20, padding: '0 8px' }}>
          {statusText}
          {s.phase === 'ERROR' && (
            <button type="button" onClick={() => { s.setHoldMode(false); s.startListen('a'); }} style={{ marginLeft: 8, padding: '2px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }}>重试</button>
          )}
        </div>
        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.holdMode} onChange={(e) => { s.setHoldMode(e.target.checked); if (e.target.checked) s.cancelListen(); }} style={{ accentColor: 'var(--accent)' }} />
          按住说话（备用）
        </label>
      </div>
    </div>
  );
}
