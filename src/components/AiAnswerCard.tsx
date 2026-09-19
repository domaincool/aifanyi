'use client';

/**
 * AI 兜底答案卡（P1：无匹配页死链修复 · 正式方案）
 * 挂载于 /understand/meaning 无匹配分支：自动请求 /api/ask/answer，加载/失败态都留明确出路。
 * 失败不渲染错误卡（返回 null），下方 cta-box 的翻译/AI 润色按钮始终可用。
 */
import { useEffect, useRef, useState } from 'react';
import { sendContentEvent } from '@/lib/metrics/client';

export default function AiAnswerCard({ q }: { q: string }) {
  const [state, setState] = useState<'loading' | 'done' | 'failed'>('loading');
  const [answer, setAnswer] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/ask/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, mode: 'meaning' }),
        });
        const d = await r.json().catch(() => null);
        if (!alive) return;
        if (r.ok && d?.ok && d.answer) {
          setAnswer(String(d.answer));
          setState('done');
          try { sendContentEvent('tool_click', 'ai_answer', 'meaning'); } catch {}
        } else {
          setState('failed');
        }
      } catch {
        if (alive) setState('failed');
      }
    })();
    return () => { alive = false; };
  }, [q]);

  if (state === 'failed') return null;

  return (
    <div className="translator-box" style={{ maxWidth: 'none' }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        {state === 'loading' ? 'AI 正在组织答案…' : 'AI 一句话答案（由 AI 生成，仅供参考）'}
      </div>
      {state === 'loading' ? (
        <div style={{ fontSize: 16, margin: '8px 0', color: 'var(--muted)' }}>正在查询「{q}」…</div>
      ) : (
        <div style={{ fontSize: 17, lineHeight: 1.7, margin: '8px 0', whiteSpace: 'pre-wrap' }}>{answer}</div>
      )}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        词典暂未收录该词 · 答案由 AI 生成
      </div>
    </div>
  );
}
