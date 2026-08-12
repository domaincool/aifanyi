'use client';
import { useEffect, useState, useCallback } from 'react';

interface UserRow { id: string; email: string; nickname: string; available: number; reserved: number; createdAt: string; }
interface ReconcileData { mismatchCount: number; mismatches: any[]; records: any[]; }

export default function AdminCreditsClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [reconcile, setReconcile] = useState<ReconcileData | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjust, setAdjust] = useState({ userId: '', amount: '', reason: '' });

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([
        fetch('/api/admin/credits/users').then(r => r.json()),
        fetch('/api/admin/credits/reconcile').then(r => r.json()),
      ]);
      if (u.error) { setError(u.error); return; }
      setUsers(u.users || []);
      setTotal(u.total || 0);
      setReconcile(r);
    } catch { setError('加载失败'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id: string) => {
    const d = await fetch(`/api/admin/credits/users/${id}`).then(r => r.json());
    setDetail(d);
  };

  const doAdjust = async () => {
    setNotice(''); setError('');
    if (!adjust.userId || !adjust.amount || !adjust.reason.trim()) { setError('请填写用户、额度与原因'); return; }
    const res = await fetch('/api/admin/credits/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: adjust.userId, amount: parseInt(adjust.amount, 10), reason: adjust.reason }),
    });
    const d = await res.json();
    if (!d.ok) { setError(d.error || '调整失败'); return; }
    setNotice(`已调整 ${d.amount} 额度`);
    setAdjust({ userId: '', amount: '', reason: '' });
    load();
    if (detail?.user?.id === adjust.userId) loadDetail(adjust.userId);
  };

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600 };
  const tdStyle: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {error && <p style={{ color: 'var(--danger)', background: 'rgba(220,53,69,.08)', padding: 10, borderRadius: 8 }}>{error}</p>}
      {notice && <p style={{ color: 'var(--accent)', background: 'rgba(25,135,84,.08)', padding: 10, borderRadius: 8 }}>{notice}</p>}

      {/* 对账报告 */}
      {reconcile && (
        <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>对账报告</h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            当前不一致账户：<b style={{ color: reconcile.mismatchCount > 0 ? 'var(--danger)' : 'var(--accent)' }}>{reconcile.mismatchCount}</b>
          </p>
          {reconcile.mismatches.length > 0 && (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>用户</th><th style={thStyle}>账面</th><th style={thStyle}>流水</th><th style={thStyle}>差异</th></tr></thead>
              <tbody>
                {reconcile.mismatches.map((m: any, i: number) => (
                  <tr key={i}><td style={tdStyle}>{m.userId}</td><td style={tdStyle}>{m.total}</td><td style={tdStyle}>{m.ledger}</td><td style={tdStyle}>{m.diff}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {reconcile.records.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>历史对账记录（{reconcile.records.length}）</summary>
              <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8 }}>
                {reconcile.records.map((r: any) => (
                  <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{r.checkType} · {r.detail}</span>
                    <span style={{ color: 'var(--muted)' }}>差 {r.diff} · {new Date(r.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {/* 调整表单 */}
      <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>调整额度</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr auto', gap: 10, alignItems: 'center' }}>
          <input placeholder="用户 ID" value={adjust.userId} onChange={e => setAdjust({ ...adjust, userId: e.target.value })} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
          <input placeholder="额度（±）" value={adjust.amount} onChange={e => setAdjust({ ...adjust, amount: e.target.value })} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
          <input placeholder="调整原因（必填）" value={adjust.reason} onChange={e => setAdjust({ ...adjust, reason: e.target.value })} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
          <button className="btn-primary" style={{ padding: '8px 16px' }} onClick={doAdjust}>调整</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>正数=发放额度，负数=扣减（不超过当前可用）。每次调整都会写入流水并记录操作人。</p>
      </section>

      {/* 用户列表 */}
      <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>用户列表（{total}）</h2>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>邮箱</th><th style={thStyle}>可用</th><th style={thStyle}>预留</th><th style={thStyle}>注册时间</th><th style={thStyle}></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => loadDetail(u.id)}>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}><b>{u.available}</b></td>
                  <td style={tdStyle}>{u.reserved}</td>
                  <td style={tdStyle}>{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td style={tdStyle}>
                    <button style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setAdjust({ ...adjust, userId: u.id }); }}>调整</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 单用户详情 */}
      {detail && (
        <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>用户详情：{detail.user?.email}</h2>
          <p style={{ fontSize: 13, margin: '0 0 12px' }}>
            可用 <b>{detail.account?.balance ?? 0}</b> · 预留 <b>{detail.account?.reservedBalance ?? 0}</b>
          </p>
          <h3 style={{ fontSize: 14, margin: '12px 0 6px' }}>最近流水</h3>
          <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 12 }}>
            {(detail.ledger || []).map((l: any) => (
              <div key={l.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{l.type} · {l.description}</span>
                <span>{new Date(l.createdAt).toLocaleString('zh-CN')}</span>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 14, margin: '12px 0 6px' }}>PDF 任务</h3>
          <div style={{ fontSize: 12 }}>
            {(detail.jobs || []).map((j: any) => (
              <div key={j.taskId} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                {j.fileName} · {j.status} · creditState={j.creditState} · 预留{j.reservedCredits}/消耗{j.consumedCredits}
              </div>
            ))}
            {(detail.jobs || []).length === 0 && <p style={{ color: 'var(--muted)' }}>无 PDF 任务</p>}
          </div>
        </section>
      )}
    </div>
  );
}
