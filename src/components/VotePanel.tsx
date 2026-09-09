'use client';

import { useState } from 'react';

/**
 * 盲测投票面板（Client Component）
 * 前端只传 anonymousId（A/B/C），真实模型映射由服务端解析，保证投票公正。
 * F10 V1：投票前只显示总票数（防从众引导）；投票后展开各译文票数与胜率，最高票标「领先」。
 * 24h 内重复投票（429）时以只读方式揭示当前战况。
 */
export default function VotePanel({
  blindtestId,
  translations,
  votesByAnon = {},
  totalVotes = 0,
}: {
  blindtestId: string;
  translations: { anonymousId: string; text: string }[];
  votesByAnon?: Record<string, number>;
  totalVotes?: number;
}) {
  const [voted, setVoted] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>(votesByAnon);
  const [total, setTotal] = useState(totalVotes);

  const revealed = voted !== null;
  const leader =
    revealed && total > 0
      ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      : undefined;

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
        setCounts((c) => ({ ...c, [anonymousId]: (c[anonymousId] || 0) + 1 }));
        setTotal((t) => t + 1);
        setMessage('投票成功，感谢参与！');
      } else if (res.status === 429) {
        setVoted('viewed');
        setMessage('24 小时内已投过票，为你展示当前战况');
      } else {
        setMessage(data.error || '投票失败');
      }
    } catch {
      setMessage('网络错误，请重试');
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>
        {total > 0 ? `${total} 票 · 三个 AI 译文匿名对决` : '暂无投票 · 来当第一个裁判'}
      </div>
      {translations.map((t) => {
        const n = counts[t.anonymousId] || 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const isLeader = revealed && leader === t.anonymousId && n > 0;
        return (
          <div key={t.anonymousId} className="translator-box" style={{ margin: '14px 0' }}>
            <div className="row" style={{ marginTop: 0 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent2)' }}>
                译文 {t.anonymousId}
                {isLeader ? ' · 领先' : ''}
              </span>
              <button className="primary" onClick={() => vote(t.anonymousId)} disabled={voted !== null}>
                {voted === t.anonymousId ? '已投票 ✓' : revealed ? '查看' : '投它'}
              </button>
            </div>
            <div className="result" style={{ marginTop: 10 }}>{t.text}</div>
            {revealed && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, background: 'rgba(128,128,128,0.18)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: 'var(--accent2)', borderRadius: 4 }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                  {n} 票 · 胜率 {pct}%
                </div>
              </div>
            )}
          </div>
        );
      })}
      {message && <p style={{ color: 'var(--muted)', marginTop: 8 }}>{message}</p>}
    </div>
  );
}
