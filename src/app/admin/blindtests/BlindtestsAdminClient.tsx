'use client';
import { useEffect, useState, useCallback } from 'react';

interface BlindtestRow {
  id: string; sourceText: string; sourceLang: string; targetLang: string;
  status: string; voteCount: number; winnerModel: string | null; createdAt: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'var(--accent)' },
  draft: { label: '草稿', color: 'var(--muted)' },
  archived: { label: '已下架', color: 'var(--danger)' },
};

export default function BlindtestsAdminClient() {
  const [list, setList] = useState<BlindtestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [createText, setCreateText] = useState('');
  const [createLang, setCreateLang] = useState('zh');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (status) sp.set('status', status);
      sp.set('page', String(page));
      const r = await fetch(`/api/admin/blindtests?${sp.toString()}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || '加载失败'); return; }
      setList(d.list || []);
      setTotal(d.total || 0);
    } catch { setError('加载失败'); } finally { setLoading(false); }
  }, [q, status, page]);

  useEffect(() => { load(); }, [load]);

  const show = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 5000); };

  const create = async () => {
    if (!createText.trim()) { setError('请输入盲测原文'); return; }
    setCreating(true); setError(''); setNotice('');
    try {
      const r = await fetch('/api/admin/blindtests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText: createText.trim(), sourceLang: createLang, targetLang: 'en' }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || '创建失败'); return; }
      setCreateText('');
      show(`已创建盲测题，三模型译文已匿名生成（${d.translations.length} 份）`);
      load();
    } catch { setError('创建请求失败'); } finally { setCreating(false); }
  };

  const changeStatus = async (row: BlindtestRow, next: string) => {
    const r = await fetch(`/api/admin/blindtests/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error || '操作失败'); return; }
    show(`已${STATUS_META[next]?.label || next}`);
    load();
  };

  const del = async (row: BlindtestRow) => {
    if (!confirm(`确认下架这道盲测题？\n「${row.sourceText.slice(0, 40)}…」`)) return;
    const r = await fetch(`/api/admin/blindtests/${row.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { setError(d.error || '删除失败'); return; }
    show('已下架');
    load();
  };

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: 13 };
  const btn: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {error && <div style={{ color: 'var(--danger)', background: 'rgba(220,53,69,.08)', padding: 10, borderRadius: 8, fontSize: 13.5 }}>{error}</div>}
      {notice && <div style={{ color: 'var(--accent)', background: 'rgba(25,135,84,.08)', padding: 10, borderRadius: 8, fontSize: 13.5 }}>{notice}</div>}

      {/* 新建 */}
      <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>新建盲测题</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={createLang} onChange={(e) => setCreateLang(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
            <option value="zh">中文 → 英文</option>
            <option value="en">英文 → 中文</option>
          </select>
          <button onClick={create} disabled={creating} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
            {creating ? '三模型生成中…（约 10-30 秒）' : '🚀 生成盲测题'}
          </button>
        </div>
        <textarea
          value={createText} onChange={(e) => setCreateText(e.target.value)}
          placeholder="输入盲测原文（≤2000 字符），如：这个视频我看了三遍，笑死我了，真是YYDS级别的操作。"
          rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, resize: 'vertical' }}
        />
      </section>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="搜索原文…"
          style={{ flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 13.5 }}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 13 }}>
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已下架</option>
        </select>
      </div>

      {/* 列表 */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>加载中…</div>
      ) : list.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13.5, padding: '24px 0' }}>暂无题目。</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>原文</th><th style={th}>语言对</th><th style={th}>投票</th>
                <th style={th}>状态</th><th style={th}>创建时间</th><th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td style={td}><div style={{ maxWidth: 360 }}>{row.sourceText}</div></td>
                  <td style={td}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{row.sourceLang}→{row.targetLang}</span></td>
                  <td style={td}>{row.voteCount}{row.winnerModel ? `（${row.winnerModel}）` : ''}</td>
                  <td style={td}><span style={{ color: STATUS_META[row.status]?.color || 'var(--muted)', fontSize: 12.5 }}>{STATUS_META[row.status]?.label || row.status}</span></td>
                  <td style={td}><span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(row.createdAt).toLocaleString('zh-CN')}</span></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {row.status === 'published' && <button onClick={() => changeStatus(row, 'draft')} style={btn}>转草稿</button>}
                      {row.status === 'draft' && <button onClick={() => changeStatus(row, 'published')} style={btn}>发布</button>}
                      {row.status === 'archived' && <button onClick={() => changeStatus(row, 'published')} style={btn}>恢复</button>}
                      {row.status !== 'archived' && <button onClick={() => del(row)} style={{ ...btn, color: 'var(--danger)' }}>下架</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={btn}>上一页</button>
        <span style={{ color: 'var(--muted)' }}>第 {page} 页 / 共 {Math.max(1, Math.ceil(total / 20))} 页（{total} 条）</span>
        <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} style={btn}>下一页</button>
      </div>
    </div>
  );
}
