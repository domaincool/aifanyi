'use client';

import { useState, useEffect, useCallback } from 'react';

interface ListingDraft {
  title: string;
  bulletPoints: string[];
  description: string;
  keywords: string[];
  faqHighlights: string[];
}

interface ListingItem {
  id: string;
  version: number;
  status: string;
  draft: ListingDraft;
  warnings?: string[] | null;
  charCount: number;
  consumedCredits: number;
  metadata?: { platform?: string; market?: string; language?: string } | null;
  createdAt: string;
}

type FieldKey = keyof ListingDraft;

interface RefinePreview {
  field: string;
  original: string;
  content: string | string[];
  changes?: { type: string; description: string }[];
  warnings?: string[];
  factConflicts?: string[];
  platformIssues?: string[];
}

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'title', label: '标题' },
  { key: 'bulletPoints', label: '卖点要点' },
  { key: 'description', label: '详情描述' },
  { key: 'keywords', label: '关键词' },
  { key: 'faqHighlights', label: 'FAQ 要点' },
];

const PLATFORMS = ['amazon', 'shopify', 'etsy', '独立站'];
const MARKETS = ['美国', '英国', '欧洲', '日本', '东南亚'];
const LANGUAGES = ['英语', '日语', '德语', '法语', '西班牙语'];

export default function ListingStudio({ productId }: { productId: string }) {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [platform, setPlatform] = useState('amazon');
  const [market, setMarket] = useState('美国');
  const [language, setLanguage] = useState('英语');
  const [busy, setBusy] = useState(false);
  const [busyField, setBusyField] = useState<FieldKey | null>(null);
  const [creditModal, setCreditModal] = useState<{ estimated: number; available: number } | null>(null);
  const [toast, setToast] = useState('');
  const [refineField, setRefineField] = useState<FieldKey | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refinePreview, setRefinePreview] = useState<RefinePreview | null>(null);
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineIdemKey, setRefineIdemKey] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const loadListings = useCallback(async () => {
    try {
      const res = await fetch(`/api/ecommerce/products/${productId}/listings`);
      const data = await res.json();
      if (data.ok) {
        const list = data.listings || [];
        setListings(list);
        if (viewVersion === null || !list.some((x: ListingItem) => x.version === viewVersion)) {
          const cur = list.find((x: ListingItem) => x.status === 'current');
          setViewVersion(cur ? cur.version : (list[0]?.version ?? null));
        }
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, [productId, viewVersion]);

  useEffect(() => { loadListings(); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = listings.find((x) => x.version === viewVersion) || null;

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ecommerce/products/${productId}/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, market, language }),
      });
      const data = await res.json();
      if (data.ok) {
        setGenOpen(false);
        setViewVersion(data.listing.version);
        showToast(`Listing 已生成（v${data.listing.version}）`);
        await loadListings();
      } else if (data.code === 'insufficient') {
        setCreditModal({ estimated: data.estimated ?? 0, available: data.available ?? 0 });
      } else {
        showToast(data.error || '生成失败');
      }
    } catch { showToast('网络错误，请重试'); }
    setBusy(false);
  };

  const regenerate = async (field: FieldKey) => {
    if (!current || busyField) return;
    setBusyField(field);
    try {
      const res = await fetch(`/api/ecommerce/listings/${current.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`「${FIELDS.find((f) => f.key === field)?.label}」已重写`);
        await loadListings();
      } else if (data.code === 'insufficient') {
        setCreditModal({ estimated: data.estimated ?? 0, available: data.available ?? 0 });
      } else {
        showToast(data.error || '重写失败');
      }
    } catch { showToast('网络错误，请重试'); }
    setBusyField(null);
  };

  const restore = async (id: string, version: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ecommerce/listings/${id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setViewVersion(data.listing.version);
        showToast(`已恢复 v${version} 为当前版本（v${data.listing.version}）`);
        await loadListings();
      } else {
        showToast(data.error || '恢复失败');
      }
    } catch { showToast('网络错误，请重试'); }
    setBusy(false);
  };

  const openRefine = (field: FieldKey) => {
    setRefineField(field);
    setRefineInstruction('');
    setRefinePreview(null);
    setRefineBusy(false);
    setRefineIdemKey(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  };

  const closeRefine = () => {
    setRefineField(null);
    setRefineInstruction('');
    setRefinePreview(null);
  };

  const submitRefine = async () => {
    if (!current || !refineField || refineBusy || !refineInstruction.trim()) return;
    setRefineBusy(true);
    try {
      const res = await fetch(`/api/ecommerce/listings/${current.id}/ai-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: refineField, instruction: refineInstruction.trim(), idempotencyKey: refineIdemKey }),
      });
      const data = await res.json();
      if (data.ok) {
        setRefinePreview(data.preview);
      } else if (data.code === 'insufficient') {
        setCreditModal({ estimated: data.estimated ?? 0, available: data.available ?? 0 });
        closeRefine();
      } else {
        showToast(data.error || 'AI 微调失败');
      }
    } catch { showToast('网络错误，请重试'); }
    setRefineBusy(false);
  };

  const applyRefine = async () => {
    if (!current || !refineField || refineBusy) return;
    setRefineBusy(true);
    try {
      const res = await fetch(`/api/ecommerce/listings/${current.id}/apply-edit`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast(`已应用修改（v${data.listing.version}）`);
        setRefineField(null);
        setRefinePreview(null);
        setRefineInstruction('');
        await loadListings();
      } else {
        showToast(data.error || '应用失败');
      }
    } catch { showToast('网络错误，请重试'); }
    setRefineBusy(false);
  };

  const fullText = (d: ListingDraft) => [
    `标题：${d.title}`,
    '',
    '卖点要点：',
    ...d.bulletPoints.map((x) => `- ${x}`),
    '',
    '详情描述：',
    d.description,
    '',
    `关键词：${d.keywords.join('、')}`,
    '',
    'FAQ 要点：',
    ...d.faqHighlights.map((x) => `- ${x}`),
  ].join('\n');

  const download = (name: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doExport = async (kind: 'copy' | 'txt' | 'csv' | 'json') => {
    if (!current) return;
    const d = current.draft;
    if (kind === 'copy') {
      try {
        await navigator.clipboard.writeText(fullText(d));
        showToast('已复制到剪贴板');
      } catch { showToast('复制失败'); }
      return;
    }
    if (kind === 'txt') {
      download(`listing-v${current.version}.txt`, fullText(d), 'text/plain;charset=utf-8');
    } else if (kind === 'json') {
      download(`listing-v${current.version}.json`, JSON.stringify(d, null, 2), 'application/json;charset=utf-8');
    } else if (kind === 'csv') {
      const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
      const rows = [
        ['field', 'content'].join(','),
        ['title', d.title].map(esc).join(','),
        ['bulletPoints', d.bulletPoints.join(' | ')].map(esc).join(','),
        ['description', d.description].map(esc).join(','),
        ['keywords', d.keywords.join(' | ')].map(esc).join(','),
        ['faqHighlights', d.faqHighlights.join(' | ')].map(esc).join(','),
      ];
      download(`listing-v${current.version}.csv`, '\ufeff' + rows.join('\n'), 'text/csv;charset=utf-8');
    }
    showToast('已导出');
  };

  const refineNewText = refinePreview ? (Array.isArray(refinePreview.content) ? refinePreview.content.join('') : String(refinePreview.content)) : '';
  const refineNoChange = !!refinePreview && refineNewText === refinePreview.original;

  return (
    <div className="ecom-listing">
      <div className="ecom-listing-head">
        <h3>Listing 文案</h3>
        <div className="ecom-listing-actions">
          {listings.length > 0 ? (
            <select
              className="ecom-select"
              value={viewVersion ?? ''}
              onChange={(e) => setViewVersion(Number(e.target.value))}
            >
              {listings.map((x) => (
                <option key={x.id} value={x.version}>
                  v{x.version}{x.status === 'current' ? ' · 当前' : ''}
                </option>
              ))}
            </select>
          ) : null}
          <button className="primary" onClick={() => setGenOpen((v) => !v)} disabled={busy}>
            {listings.length === 0 ? '✨ 生成 Listing' : '✨ 生成新版本'}
          </button>
        </div>
      </div>

      {genOpen ? (
        <div className="ecom-gen-form">
          <div className="ecom-gen-row">
            <label className="ecom-label">平台</label>
            <select className="ecom-select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="ecom-gen-row">
            <label className="ecom-label">目标市场</label>
            <select className="ecom-select" value={market} onChange={(e) => setMarket(e.target.value)}>
              {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="ecom-gen-row">
            <label className="ecom-label">输出语言</label>
            <select className="ecom-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button className="ecom-enrich-btn" onClick={generate} disabled={busy}>
            {busy ? '生成中…' : '开始生成'}
          </button>
        </div>
      ) : null}

      {!loaded ? (
        <div className="ecom-muted-line">加载中…</div>
      ) : !current ? (
        <div className="ecom-muted-line">尚未生成 Listing，点击上方按钮开始</div>
      ) : (
        <div className="ecom-listing-body">
          {current.status === 'history' ? (
            <div className="ecom-history-bar">
              <span>这是历史版本 v{current.version}</span>
              <button className="ecom-btn-ghost" onClick={() => restore(current.id, current.version)} disabled={busy}>恢复此版本为当前</button>
            </div>
          ) : null}

          {FIELDS.map((f) => {
            const val = current.draft[f.key];
            return (
              <div key={f.key} className="ecom-listing-field">
                <div className="ecom-listing-field-head">
                  <span className="ecom-listing-field-label">{f.label}</span>
                  {current.status === 'current' ? (
                    <div className="ecom-listing-field-actions">
                      <button className="ecom-refine" onClick={() => openRefine(f.key)} disabled={refineBusy || busyField !== null}>✦ AI 微调</button>
                      <button className="ecom-rewrite" onClick={() => regenerate(f.key)} disabled={busyField !== null || refineBusy}>
                        {busyField === f.key ? '重写中…' : '↻ 重写'}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="ecom-listing-field-body">
                  {f.key === 'title' ? (
                    <p className="ecom-listing-title">{String(val)}</p>
                  ) : f.key === 'description' ? (
                    <p className="ecom-listing-desc">{String(val)}</p>
                  ) : f.key === 'keywords' ? (
                    <div className="ecom-kw-wrap">
                      {(val as string[]).map((k, i) => <span key={i} className="ecom-tag">{k}</span>)}
                    </div>
                  ) : (
                    <ul className="ecom-bullets">
                      {(val as string[]).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}

          {Array.isArray(current.warnings) && current.warnings.length > 0 ? (
            <div className="ecom-need-confirm">
              <label>⚠️ 待确认（Fact Validation）</label>
              <ul>{current.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}

          {current.status === 'current' ? (
            <div className="ecom-export">
              <span className="ecom-muted-line">导出：</span>
              <button className="ecom-btn-ghost" onClick={() => doExport('copy')}>复制全文</button>
              <button className="ecom-btn-ghost" onClick={() => doExport('txt')}>TXT</button>
              <button className="ecom-btn-ghost" onClick={() => doExport('csv')}>CSV</button>
              <button className="ecom-btn-ghost" onClick={() => doExport('json')}>JSON</button>
            </div>
          ) : null}
        </div>
      )}

      {refineField ? (
        <div className="ecom-mask" onClick={() => { if (!refineBusy) closeRefine(); }}>
          <div className="ecom-modal ecom-refine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ecom-modal-head">
              <h3>AI 微调</h3>
              <span className="ecom-muted-line">{FIELDS.find((f) => f.key === refineField)?.label}</span>
            </div>
            {refinePreview ? (
              <div className="ecom-refine-preview">
                <div className="ecom-refine-cmp">
                  <label>原内容</label>
                  <div className="ecom-refine-box ecom-refine-orig">{refinePreview.original}</div>
                </div>
                <div className="ecom-refine-cmp">
                  <label>AI 微调后</label>
                  <div className="ecom-refine-box ecom-refine-new">{Array.isArray(refinePreview.content) ? refinePreview.content.join('\n') : refinePreview.content}</div>
                </div>
                {Array.isArray(refinePreview.changes) && refinePreview.changes.length > 0 ? (
                  <div className="ecom-refine-changes">
                    <label>修改说明</label>
                    <ul>{refinePreview.changes.map((c, i) => <li key={i}>{c.description}</li>)}</ul>
                  </div>
                ) : null}
                {Array.isArray(refinePreview.factConflicts) && refinePreview.factConflicts.length > 0 ? (
                  <div className="ecom-need-confirm"><label>⚠️ 事实冲突</label><ul>{refinePreview.factConflicts.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
                ) : null}
                {Array.isArray(refinePreview.platformIssues) && refinePreview.platformIssues.length > 0 ? (
                  <div className="ecom-need-confirm"><label>⚠️ 平台规则</label><ul>{refinePreview.platformIssues.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
                ) : null}
                {Array.isArray(refinePreview.warnings) && refinePreview.warnings.length > 0 ? (
                  <div className="ecom-need-confirm"><label>⚠️ 提示</label><ul>{refinePreview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
                ) : null}
                <div className="ecom-modal-actions">
                  <button className="ecom-btn-ghost" onClick={() => { setRefinePreview(null); setRefineInstruction(''); }} disabled={refineBusy}>取消修改</button>
                  <button className="primary" onClick={applyRefine} disabled={refineBusy || refineNoChange}>{refineBusy ? '应用中…' : (refineNoChange ? '无需应用' : '应用修改')}</button>
                </div>
              </div>
            ) : (
              <div>
                <p className="ecom-refine-hint">告诉 AI 你希望怎么修改（只改当前字段，不改变产品事实）。</p>
                <textarea
                  className="ecom-refine-input"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="例如：突出便携性，语气更专业，但不要改变产品信息。"
                  rows={4}
                  maxLength={1000}
                />
                <div className="ecom-modal-actions">
                  <button className="ecom-btn-ghost" onClick={closeRefine} disabled={refineBusy}>取消</button>
                  <button className="primary" onClick={submitRefine} disabled={refineBusy || !refineInstruction.trim()}>{refineBusy ? '生成中…' : '生成修改'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {creditModal ? (
        <div className="ecom-mask" onClick={() => setCreditModal(null)}>
          <div className="ecom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ecom-modal-head"><h3>积分不足</h3></div>
            <p className="ecom-credit-text">本次预计需要 <b>{creditModal.estimated}</b> 积分，当前可用 <b>{creditModal.available}</b> 积分。</p>
            <div className="ecom-modal-actions">
              <button className="ecom-btn-ghost" onClick={() => setCreditModal(null)}>取消</button>
              <a className="primary" href="/credit">获取积分</a>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
