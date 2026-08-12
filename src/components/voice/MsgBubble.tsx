'use client';

/** MsgBubble：对话气泡（三视图共用）
 * 原文 + 译文 + 播放/暂停/重播 + 复制 + 自动播放被拦 fallback + TTS 失败提示 + 额度
 */
import { useState } from 'react';
import { LANG_LABEL, VoiceMsg } from '@/lib/voice/useVoiceSession';

export default function MsgBubble(props: {
  msg: VoiceMsg;
  playing: boolean;
  onPlay: (m: VoiceMsg) => void;
  onStop: () => void;
  dark?: boolean; // 横屏双端模式深色底
}) {
  const { msg, playing, onPlay, onStop, dark } = props;
  const [copied, setCopied] = useState(false);
  const sideLabel = msg.side === 'a' ? 'A' : 'B';
  const dirLabel = (LANG_LABEL[msg.sourceLang] || msg.sourceLang) + ' → ' + (LANG_LABEL[msg.targetLang] || msg.targetLang);

  const copy = () => {
    try {
      navigator.clipboard.writeText(msg.text + '\n' + msg.translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const bg = dark ? 'rgba(255,255,255,.08)' : (msg.side === 'a' ? 'rgba(37,99,235,.12)' : 'rgba(34,211,164,.12)');
  const alignSelf = msg.side === 'a' ? 'flex-start' : 'flex-end';

  return (
    <div style={{ display: 'flex', justifyContent: msg.side === 'a' ? 'flex-start' : 'flex-end' }}>
      <div style={{ maxWidth: '86%', background: bg, border: '1px solid ' + (dark ? 'rgba(255,255,255,.12)' : 'var(--border)'), borderRadius: 14, padding: '10px 12px', marginBottom: 8, alignSelf }}>
        <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,.55)' : 'var(--muted)', marginBottom: 3 }}>
          {sideLabel} · {dirLabel} · {msg.time}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: dark ? '#fff' : 'var(--text)' }}>{msg.text}</div>
        <div style={{ fontSize: 15, color: dark ? 'rgba(255,255,255,.75)' : 'var(--muted)', marginTop: 3 }}>{msg.translation}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {msg.audioBase64 && !msg.ttsFailed && (
            <button
              type="button"
              onClick={() => (playing ? onStop() : onPlay(msg))}
              style={{ padding: '4px 12px', fontSize: 13, borderRadius: 8, border: '1px solid ' + (dark ? 'rgba(255,255,255,.2)' : 'var(--border)'), background: 'transparent', color: dark ? '#fff' : 'var(--text)', cursor: 'pointer', minHeight: 32 }}
            >
              {playing ? '⏸ 暂停' : '▶ 播放'}
            </button>
          )}
          {msg.audioBase64 && !msg.ttsFailed && !playing && (
            <button
              type="button"
              onClick={() => onPlay(msg)}
              style={{ padding: '4px 12px', fontSize: 13, borderRadius: 8, border: '1px solid ' + (dark ? 'rgba(255,255,255,.2)' : 'var(--border)'), background: 'transparent', color: dark ? '#fff' : 'var(--text)', cursor: 'pointer', minHeight: 32 }}
            >
              ↻ 重播
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            style={{ padding: '4px 12px', fontSize: 13, borderRadius: 8, border: '1px solid ' + (dark ? 'rgba(255,255,255,.2)' : 'var(--border)'), background: 'transparent', color: dark ? '#fff' : 'var(--text)', cursor: 'pointer', minHeight: 32 }}
          >
            {copied ? '✓ 已复制' : '⧉ 复制'}
          </button>
          {msg.usedCredits > 0 && (
            <span style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,.5)' : 'var(--muted)' }}>本次使用 {msg.usedCredits} 个额度</span>
          )}
        </div>
        {msg.autoplayBlocked && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#d97706', background: 'rgba(217,119,6,.1)', borderRadius: 8, padding: '6px 10px' }}>
            🔇 浏览器禁止自动播放，点击上方「▶ 播放」听译文
          </div>
        )}
        {msg.ttsFailed && (
          <div style={{ marginTop: 6, fontSize: 12, color: dark ? 'rgba(255,255,255,.5)' : 'var(--muted)' }}>语音生成失败，可复制译文使用</div>
        )}
      </div>
    </div>
  );
}
