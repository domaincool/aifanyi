'use client';

import { useState } from 'react';

/**
 * 盲测投票面板（Client Component）
 * 前端只传 anonymousId（A/B/C），真实模型映射由服务端解析，保证投票公正
 */
export default function VotePanel({
  blindtestId,
  translations,
}: {
  blindtestId: string;
  translations: { anonymousId: string; text: string }[];
}) {
  const [voted, setVoted] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function vote(anonymousId: string) {
    if (voted) return;
    setMessage('');
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blindtestId, anonymousId }),
      });
      const data = await res.json();
      if (data.ok) {
        setVoted(anonymousId);
        setMessage('投票成功，感谢参与！');
      } else {
        setMessage(data.error || '投票失败');
      }
    } catch {
      setMessage('网络错误，请重试');
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      {translations.map((t) => (
        <div key={t.anonymousId} className="translator-box" style={{ margin: '14px 0' }}>
          <div className="row" style={{ marginTop: 0 }}>
            <span style={{ fontWeight: 700, color: 'var(--accent2)' }}>译文 {t.anonymousId}</span>
            <button
              className="primary"
              onClick={() => vote(t.anonymousId)}
              disabled={voted !== null}
            >
              {voted === t.anonymousId ? '已投票 ✓' : '投它'}
            </button>
          </div>
          <div className="result" style={{ marginTop: 10 }}>{t.text}</div>
        </div>
      ))}
      {message && <p style={{ color: 'var(--muted)', marginTop: 8 }}>{message}</p>}
    </div>
  );
}
