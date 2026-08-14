'use client';
import { useEffect, useState, useCallback } from 'react';

interface MemeRow {
  id: string; term: string; slug: string; meaning: string; translation: string;
  examples: { zh: string; en: string }[]; tags: string[]; popularity: number;
  status: string; createdAt: string; updatedAt: string;
}
interface ImportResult {
  ok: boolean; batchId: string; imported: number; updated: number; skipped: number;
  conflicts: { index: number; term: string; reason: string }[]; created: string[]; repeated?: boolean;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'var(--accent)' },
  draft: { label: '草稿', color: 'var(--muted)' },
  archived: { label: '已下架', color: 'var(--danger)' },
};

export default function MemesAdminClient() {
  const [memes, setMemes] = useState<MemeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 编辑态
  const [editing, setEditing] = useState<MemeRow | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // 导入面板
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBatch, setImportBatch] = useState('');
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (status) sp.set('status', status);
      sp.set('page', String(page));
      const r = await fetch(`/api/admin/memes?${sp.toString()}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || '加载失败'); return; }
      setMemes(d.memes || []);
      setTotal(d.total || 0);
    } catch { setError('加载失败'); } finally { setLoading(false); }
  }, [q, status, page]);

  useEffect(() => { load(); }, [load]);

  const show = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  // ── 批量导入 ──
  const runImport = async (dryRun: boolean) => {
    let items: any[];
    try {
      items = JSON.parse(importText);
      if (!Array.isArray(items)) throw new Error('顶层必须是数组');
    } catch (e: any) {
      setError('JSON 解析失败：' + e.message);
      return;
    }
    setImportBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/memes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: importBatch || `batch-${Date.now()}`, items, dryRun, updateExisting: false }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || '导入失败'); return; }
      setImportPreview(d);
      if (!dryRun && !d.repeated) {
        show(`已导入 ${d.imported} 条，跳过重复 ${d.skipped} 条，冲突 ${d.conflicts.length} 条`);
        load();
      } else if (d.repeated) {
        show(`batchId 幂等命中：重复提交未入库（首次结果 imported=${d.imported}）`);
      }
    } catch { setError('导入请求失败'); } finally { setImportBusy(false); }
  };

  // ── 编辑 ──
  const openEdit = (m: MemeRow) => {
    setEditing(m);
    setEditForm({
      term: m.term, slug: m.slug, meaning: m.meaning, translation: m.translation,
      examples: JSON.stringify(m.examples || []), tags: (m.tags || []).join(','),
      popularity: m.popularity, status: m.status,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setError('');
    let examples: { zh: string; en: string }[];
    try { examples = JSON.parse(editForm.examples || '[]'); } catch { setError('例句 JSON 解析失败'); return; }
    const body: any = {
      term: editForm.term.trim(), slug: editForm.slug.trim(), meaning: editForm.meaning.trim(),
      translation: editForm.translation.trim(), examples,
      tags: editForm.tags.split(',').map((s: string) => s.trim()).filter(Boolean),
      popularity: parseInt(editForm.popularity || '0', 10), status: editForm.status,
    };
    const r = await fetch(`/api/admin/memes/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { setError(d.error || '保存失败'); return; }
    setEditing(null);
    show(`已保存：${body.term}`);
    load();
  };

  const setMemeStatus = async (m: MemeRow, next: string) => {
    const r = await fetch(`/api/admin/memes/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    const d = await r.json();
    if (!r.ok) { setError(d.error || '操作失败'); return; }
    show(`${m.term} → ${STATUS_META[next]?.label || next}`);
    load();
  };

  const deleteMeme = async (m: MemeRow) => {
    if (!confirm(`确认下架「${m.term}」？下架后前台与 sitemap 不再展示。`)) return;
    const r = await fetch(`/api/admin/memes/${m.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { setError(d.error || '删除失败'); return; }
    show(`已下架：${m.term}`);
    load();
  };

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: 13 };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {error && <div style={{ color: 'var(--danger)', background: 'rgba(220,53,69,.08)', padding: 10, borderRadius: 8, fontSize: 13.5 }}>{error}</div>}
      {notice && <div style={{ color: 'var(--accent)', background: 'rgba(25,135,84,.08)', padding: 10, borderRadius: 8, fontSize: 13.5 }}>{notice}</div>}

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="搜索 term / slug / 含义 / 译文…"
          style={{ flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 13.5 }}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 13 }}>
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已下架</option>
        </select>
        <button onClick={() => setImportOpen(!importOpen)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
          {importOpen ? '收起导入' : '📥 批量导入'}
        </button>
      </div>

      {/* 批量导入面板 */}
      {importOpen && (
        <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>批量导入词条（Primary 通道）</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            格式：[{"{ term, slug, meaning, translation, examples:[{zh,en}], tags:[], popularity }"}]（与 meme-batch 数据同构）。先「预览冲突」再「确认导入」。
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={importBatch} onChange={(e) => setImportBatch(e.target.value)}
              placeholder="batchId（如 meme-batch-008-20260815，留空自动生成）"
              style={{ flex: 1, minWidth: 240, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
          <textarea
            value={importText} onChange={(e) => setImportText(e.target.value)}
            placeholder={'粘贴 JSON 数组，例如：\n[\n  { "term": "测试词", "slug": "ce-shi-ci", "meaning": "含义", "translation": "EN", "examples": [{"zh":"例句","en":"EN"}], "tags": ["测试"], "popularity": 50 }\n]'}
            rows={8}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'Consolas,monospace', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => runImport(true)} disabled={importBusy} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
              {importBusy ? '处理中…' : '🔍 预览冲突（dryRun）'}
            </button>
            <button onClick={() => runImport(false)} disabled={importBusy} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              {importBusy ? '处理中…' : '✅ 确认导入'}
            </button>
          </div>
          {importPreview && (
            <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
              <div>
                <span style={{ color: 'var(--accent)' }}>可导入 {importPreview.imported}</span>
                <span style={{ color: 'var(--muted)' }}> · 更新 {importPreview.updated}</span>
                <span style={{ color: 'var(--amber)' }}> · 跳过重复 {importPreview.skipped}</span>
                <span style={{ color: 'var(--danger)' }}> · 冲突 {importPreview.conflicts.length}</span>
                {importPreview.repeated && <span style={{ color: 'var(--muted)' }}> · <b>幂等命中（未重复入库）</b></span>}
              </div>
              {importPreview.conflicts.length > 0 && (
                <div style={{ background: 'rgba(245,158,11,.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>
                  {importPreview.conflicts.map((c, i) => (
                    <div key={i}>#{c.index}「{c.term || '(空)'}」→ {c.reason}</div>
                  ))}
                </div>
              )}
              {importPreview.created.length > 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>新入库：{importPreview.created.slice(0, 10).join('、')}{importPreview.created.length > 10 ? ` 等 ${importPreview.created.length} 条` : ''}</div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 列表 */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>加载中…</div>
      ) : memes.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13.5, padding: '24px 0' }}>暂无词条，调整筛选或批量导入。</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>term</th><th style={th}>slug</th><th style={th}>译文</th><th style={th}>分类</th>
                <th style={th}>热度</th><th style={th}>状态</th><th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {memes.map((m) => (
                <tr key={m.id}>
                  <td style={td}><b>{m.term}</b></td>
                  <td style={td}><code style={{ fontSize: 12 }}>{m.slug}</code></td>
                  <td style={td}>{m.translation}</td>
                  <td style={td}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{(m.tags || []).join(' / ')}</span></td>
                  <td style={td}>{m.popularity}</td>
                  <td style={td}><span style={{ color: STATUS_META[m.status]?.color || 'var(--muted)', fontSize: 12.5 }}>{STATUS_META[m.status]?.label || m.status}</span></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => openEdit(m)} style={btn}>编辑</button>
                      {m.status === 'published' && <button onClick={() => setMemeStatus(m, 'draft')} style={btn}>转草稿</button>}
                      {m.status === 'draft' && <button onClick={() => setMemeStatus(m, 'published')} style={btn}>发布</button>}
                      {m.status !== 'archived' && <button onClick={() => deleteMeme(m)} style={{ ...btn, color: 'var(--danger)' }}>下架</button>}
                      {m.status === 'archived' && <button onClick={() => setMemeStatus(m, 'published')} style={btn}>恢复</button>}
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
        <span style={{ color: 'var(--muted)' }}>第 {page} 页 / 共 {Math.max(1, Math.ceil(total / 48))} 页（{total} 条）</span>
        <button disabled={page * 48 >= total} onClick={() => setPage(page + 1)} style={btn}>下一页</button>
      </div>

      {/* 编辑弹层 */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>编辑词条：{editing.term}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={lab}>term（唯一）
                <input value={editForm.term} onChange={(e) => setEditForm({ ...editForm, term: e.target.value })} style={inp} />
              </label>
              <label style={lab}>slug（唯一，SEO URL）
                <input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} style={inp} />
              </label>
            </div>
            <label style={lab}>含义
              <input value={editForm.meaning} onChange={(e) => setEditForm({ ...editForm, meaning: e.target.value })} style={inp} />
            </label>
            <label style={lab}>地道英文
              <input value={editForm.translation} onChange={(e) => setEditForm({ ...editForm, translation: e.target.value })} style={inp} />
            </label>
            <label style={lab}>例句 JSON（[{"{zh,en}"}]）
              <textarea value={editForm.examples} onChange={(e) => setEditForm({ ...editForm, examples: e.target.value })} rows={3} style={{ ...inp, fontFamily: 'Consolas,monospace', fontSize: 12 }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label style={lab}>分类 tags（逗号分隔）
                <input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} style={inp} />
              </label>
              <label style={lab}>热度
                <input type="number" value={editForm.popularity} onChange={(e) => setEditForm({ ...editForm, popularity: e.target.value })} style={inp} />
              </label>
              <label style={lab}>状态
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={inp}>
                  <option value="published">已发布</option>
                  <option value="draft">草稿</option>
                  <option value="archived">已下架</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={() => setEditing(null)} style={{ ...btn, padding: '8px 16px' }}>取消</button>
              <button onClick={saveEdit} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' };
const lab: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted)', display: 'grid', gap: 4 };
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, width: '100%' };
