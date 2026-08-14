'use client';
import { useEffect, useState, useCallback } from 'react';

interface AuditRow {
  id: string; operator: string; action: string; targetId: string | null;
  batchId: string | null; params: any; result: any; ip: string | null; createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  'memes.import': '词条批量导入',
  'memes.create': '词条创建',
  'memes.update': '词条编辑',
  'memes.delete_soft': '词条下架',
  'memes.delete_hard': '词条硬删',
  'blindtests.create': '盲测题创建',
  'blindtests.update': '盲测题状态',
  'blindtests.delete_soft': '盲测题下架',
};

export default function AuditClient() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [operator, setOperator] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const sp = new URLSearchParams();
      if (operator) sp.set('operator', operator);
      if (action) sp.set('action', action);
      sp.set('page', String(page));
      const r = await fetch(`/api/admin/audit?${sp.toString()}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || '加载失败'); return; }
      setLogs(d.logs || []);
      setTotal(d.total || 0);
    } catch { setError('加载失败'); } finally { setLoading(false); }
  }, [operator, action, page]);

  useEffect(() => { load(); }, [load]);

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: 12.5 };
  const btn: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <div style={{ color: 'var(--danger)', background: 'rgba(220,53,69,.08)', padding: 10, borderRadius: 8, fontSize: 13.5 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={operator} onChange={(e) => { setOperator(e.target.value); setPage(1); }}
          placeholder="operator（如 ops-token 或邮箱）"
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 13 }}
        />
        <input
          value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
          placeholder="action（如 memes.import）"
          style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 13 }}
        />
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>加载中…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13.5, padding: '24px 0' }}>暂无日志。</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>时间</th><th style={th}>操作</th><th style={th}>operator</th>
                <th style={th}>参数</th><th style={th}>结果</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{new Date(l.createdAt).toLocaleString('zh-CN')}</td>
                  <td style={td}>
                    <code style={{ fontSize: 12 }}>{l.action}</code>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{ACTION_LABEL[l.action] || ''}</div>
                  </td>
                  <td style={td}>{l.operator}{l.batchId ? <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>batch: {l.batchId}</div> : null}</td>
                  <td style={{ ...td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.params ? JSON.stringify(l.params) : ''}
                  </td>
                  <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                    {l.result ? JSON.stringify(l.result) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={btn}>上一页</button>
        <span style={{ color: 'var(--muted)' }}>第 {page} 页 / 共 {Math.max(1, Math.ceil(total / 50))} 页（{total} 条）</span>
        <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)} style={btn}>下一页</button>
      </div>
    </div>
  );
}
