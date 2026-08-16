'use client';
import { beijingDateKey } from '@/lib/time-beijing';
import { useEffect, useState, useCallback } from 'react';

interface Stats {
  users: { total: number; activeSessions: number; creditAccounts: number };
  content: { memes: number; memesByStatus: Record<string, number>; blindtestsByStatus: Record<string, number> };
  blindtest: { total: number; votes: number; votesByModel: Record<string, number> };
  translation: { total: number; cached: number; cacheHitRate: number; byModel: Record<string, { calls: number; costUsd: number }>; costUsdTotal: number; last7Days: { date: string; count: number }[] };
  pdf: { jobs: number; costUsdTotal: number; avgDurationMs: number; p50DurationMs: number; p95DurationMs: number; events: Record<string, number> };
}

interface AuditRow { id: string; operator: string; action: string; params: any; createdAt: string; }

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, a] = await Promise.all([
        fetch('/api/stats').then((r) => r.json()),
        fetch('/api/admin/audit?page=1').then((r) => r.json()),
      ]);
      if (!s.ok) { setError(s.error || '加载失败'); return; }
      setStats(s);
      setAudit((a.logs || []).slice(0, 6));
    } catch { setError('加载失败'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <div style={{ color: 'var(--danger)', background: 'rgba(220,53,69,.08)', padding: 12, borderRadius: 8, fontSize: 13.5 }}>{error}</div>;
  if (!stats) return <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>加载中…</div>;

  const t = stats.translation;
  const modelNames: Record<string, string> = { deepseek: 'DeepSeek', glm: 'GLM', google: 'Google', openai: 'OpenAI', claude: 'Claude' };

  // 近 7 天补零
  const days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = beijingDateKey(d);
    const hit = t.last7Days.find((x) => x.date === key);
    days.push({ date: key.slice(5), count: hit ? hit.count : 0 });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const W = 560, H = 150, PAD = 24;
  const pts = days.map((d, i) => `${PAD + (i * (W - PAD * 2)) / 6},${H - PAD - (d.count / maxCount) * (H - PAD * 2)}`).join(' ');

  const metric = (label: string, value: string | number, sub?: string) => (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>运营看板</div>
        <a
          href="/api/admin/export"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          导出 CSV
        </a>
      </div>
      {/* 指标卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {metric('用户', stats.users.total, `${stats.users.activeSessions} 活跃会话 · ${stats.users.creditAccounts} 积分账户`)}
        {metric('翻译任务', t.total, `${(t.cacheHitRate * 100).toFixed(1)}% 缓存命中`)}
        {metric('总成本', '$' + t.costUsdTotal.toFixed(4), Object.entries(t.byModel).map(([m, v]) => `${modelNames[m] || m} $${v.costUsd.toFixed(4)}`).join(' · '))}
        {metric('梗词条', stats.content.memes, `已发布 ${stats.content.memesByStatus['published'] ?? 0} · 草稿 ${stats.content.memesByStatus['draft'] ?? 0} · 下架 ${stats.content.memesByStatus['archived'] ?? 0}`)}
        {metric('盲测题', stats.blindtest.total, `${stats.blindtest.votes} 票`)}
        {metric('PDF 任务', stats.pdf.jobs, `p95 ${Math.round(stats.pdf.p95DurationMs / 1000)}s`)}
      </div>

      {/* 近 7 天趋势 */}
      <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>翻译调用 · 近 7 天</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxWidth: 640, display: 'block' }}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={PAD} x2={W - PAD} y1={H - PAD - f * (H - PAD * 2)} y2={H - PAD - f * (H - PAD * 2)} stroke="var(--border)" strokeWidth="1" />
          ))}
          <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {days.map((d, i) => (
            <g key={i}>
              <circle cx={PAD + (i * (W - PAD * 2)) / 6} cy={H - PAD - (d.count / maxCount) * (H - PAD * 2)} r="3.5" fill="var(--accent)" />
              <text x={PAD + (i * (W - PAD * 2)) / 6} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.date}</text>
              <text x={PAD + (i * (W - PAD * 2)) / 6} y={H - PAD - (d.count / maxCount) * (H - PAD * 2) - 8} textAnchor="middle" fontSize="10" fill="var(--text)">{d.count}</text>
            </g>
          ))}
        </svg>
      </section>

      {/* 最近审计 */}
      <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>最近管理操作 <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>（<a href="/admin/audit" style={{ color: 'var(--accent)' }}>全部日志 →</a>）</span></div>
        {audit.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>暂无管理操作记录</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {audit.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <code style={{ fontSize: 12 }}>{l.action}</code>
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12 }}>{l.operator}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
                    {l.params ? JSON.stringify(l.params).slice(0, 60) : ''}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(l.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
