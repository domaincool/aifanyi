'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AssetItem {
  id: string;
  type: string;
  mime: string;
  size: number;
  originalName?: string | null;
  createdAt: string;
  _count?: { translations: number };
}

interface TranslationResult {
  id: string;
  targetLang: string;
  ocrText: string[];
  translated: string[];
  status: string;
  consumedCredits: number;
  createdAt: string;
}

const LANGS = [
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'es', label: '西班牙语' },
];

export default function AssetPanel({ productId }: { productId: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<AssetItem | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creditModal, setCreditModal] = useState<{ estimated: number; available: number } | null>(null);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const loadAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/ecommerce/products/${productId}/assets`);
      const data = await res.json();
      if (data.ok) setAssets(data.assets || []);
    } catch { /* ignore */ }
    setLoaded(true);
  }, [productId]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const openAsset = async (a: AssetItem) => {
    setSelected(a);
    setTranslation(null);
    setImgUrl(null);
    try {
      const res = await fetch(`/api/ecommerce/assets/${a.id}`);
      const data = await res.json();
      if (data.ok) setImgUrl(data.url);
    } catch { /* ignore */ }
  };

  const upload = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/ecommerce/products/${productId}/assets`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.ok) {
        showToast('图片已上传');
        await loadAssets();
      } else {
        showToast(data.error || '上传失败');
      }
    } catch { showToast('网络错误，请重试'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const translate = async () => {
    if (!selected || translating) return;
    setTranslating(true);
    setTranslation(null);
    try {
      const res = await fetch(`/api/ecommerce/assets/${selected.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang }),
      });
      const data = await res.json();
      if (data.ok) {
        setTranslation(data.translation);
        showToast(`翻译完成，本次使用 ${data.consumedCredits} 积分`);
      } else if (data.code === 'insufficient') {
        setCreditModal({ estimated: data.estimated ?? 0, available: data.available ?? 0 });
      } else {
        showToast(data.error || '翻译失败');
      }
    } catch { showToast('网络错误，请重试'); }
    setTranslating(false);
  };

  return (
    <div className="ecom-asset">
      <div className="ecom-listing-head">
        <h3>商品图片翻译</h3>
        <button className="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? '上传中…' : '+ 上传图片'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
      </div>

      {!loaded ? (
        <div className="ecom-muted-line">加载中…</div>
      ) : assets.length === 0 ? (
        <div className="ecom-muted-line">还没有图片，上传商品图后可识别并翻译图上文字</div>
      ) : (
        <div className="ecom-asset-grid">
          {assets.map((a) => (
            <button key={a.id} className={`ecom-asset-card ${selected?.id === a.id ? 'ecom-asset-active' : ''}`} onClick={() => openAsset(a)}>
              <span className="ecom-asset-name">{a.originalName || '图片'}</span>
              <span className="ecom-muted">{Math.round(a.size / 1024)} KB</span>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="ecom-asset-detail">
          <div className="ecom-asset-preview">
            {imgUrl ? <img src={imgUrl} alt={selected.originalName || '商品图片'} className="ecom-asset-img" /> : <div className="ecom-muted-line">加载图片…</div>}
          </div>
          <div className="ecom-asset-side">
            <div className="ecom-gen-row">
              <label className="ecom-label">翻译成</label>
              <select className="ecom-select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <button className="ecom-enrich-btn" onClick={translate} disabled={translating}>
                {translating ? '翻译中…' : '识别并翻译'}
              </button>
            </div>

            {translation ? (
              <div className="ecom-asset-result">
                {(translation.ocrText || []).map((src, i) => {
                  const dst = translation.translated?.[i] || '';
                  return (
                    <div key={i} className="ecom-asset-row">
                      <div className="ecom-asset-src">{src}</div>
                      <div className="ecom-asset-dst">{dst}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
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
