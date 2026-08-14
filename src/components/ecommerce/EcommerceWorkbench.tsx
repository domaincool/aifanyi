'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import ListingStudio from './ListingStudio';

interface UserInfo { id: string; email?: string; nickname?: string; avatar?: string; }

interface Product {
  id: string;
  projectId: string;
  productName: string;
  category?: string | null;
  brand?: string | null;
  sourceLang: string;
  targetMarket?: string | null;
  platform?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { listings: number; assets: number };
}

interface ProductDetail extends Product {
  sourceDescription?: string | null;
  features?: string[] | null;
  specifications?: string[] | null;
  materials?: string[] | null;
}

interface EnrichResult {
  category?: string;
  brand?: string;
  features?: string[];
  specifications?: string[];
  materials?: string[];
  targetMarket?: string;
  keywords?: string[];
  sellingPoints?: string[];
  needConfirm?: string[];
}

export default function EcommerceWorkbench({ serverUser }: { serverUser: UserInfo | null }) {
  const [user] = useState<UserInfo | null>(serverUser);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [enriched, setEnriched] = useState<EnrichResult | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [creditModal, setCreditModal] = useState<{ estimated: number; available: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [toast, setToast] = useState('');

  const openLogin = () => {
    try {
      document.cookie = `aifanyi_next=${encodeURIComponent('/ecommerce')}; path=/; max-age=1800; samesite=lax`;
    } catch { /* ignore */ }
    window.dispatchEvent(new Event('open-login-modal'));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ecommerce/products');
      const data = await res.json();
      if (data.ok) setProducts(data.products || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) loadProducts();
    else setLoading(false);
  }, [user, loadProducts]);

  const openDetail = useCallback(async (id: string) => {
    setSelected(null);
    setEnriched(null);
    try {
      const res = await fetch(`/api/ecommerce/products/${id}`);
      const data = await res.json();
      if (data.ok) setSelected(data.product);
    } catch { /* ignore */ }
  }, []);

  const createProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formName.trim() || formBusy) return;
    setFormBusy(true);
    try {
      const res = await fetch('/api/ecommerce/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setFormName('');
        setFormDesc('');
        setShowForm(false);
        showToast('商品已创建');
        await loadProducts();
        await openDetail(data.product.id);
      } else {
        showToast(data.error || '创建失败');
      }
    } catch {
      showToast('网络错误，请重试');
    }
    setFormBusy(false);
  };

  const runEnrich = async () => {
    if (!selected || enriching) return;
    setEnriching(true);
    setEnriched(null);
    try {
      const res = await fetch(`/api/ecommerce/products/${selected.id}/enrich`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setEnriched(data.enriched);
        showToast(`AI 提取完成，本次使用 ${data.consumedCredits} 额度`);
        await openDetail(selected.id);
      } else if (data.code === 'insufficient') {
        setCreditModal({ estimated: data.estimated ?? 0, available: data.available ?? 0 });
      } else if (data.code === 'auth_required') {
        showToast('请先登录');
      } else {
        showToast(data.error || '提取失败');
      }
    } catch {
      showToast('网络错误，请重试');
    }
    setEnriching(false);
  };

  if (!user) {
    return (
      <div className="ecom-page">
        <div className="ecom-hero">
          <h1>跨境电商工作台</h1>
          <p>AI 提取商品卖点 · 生成 Listing 文案 · 翻译图片与客户消息</p>
        </div>
        <div className="ecom-login-gate">
          <div className="ecom-login-icon">🧳</div>
          <h2>登录后开始使用</h2>
          <p>工作台数据仅你可见。新用户注册即送 300 免费额度，翻译成功才扣费，失败自动退回。</p>
          <button className="primary" onClick={openLogin}>登录 / 注册</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ecom-page">
      <div className="ecom-hero">
        <h1>跨境电商工作台</h1>
        <p>我的商品 · AI 提取卖点 · 生成 Listing 文案</p>
      </div>

      <div className="ecom-toolbar">
        <span className="ecom-count">{loading ? '加载中…' : `${products.length} 个商品`}</span>
        <button className="primary" onClick={() => setShowForm(true)}>+ 新建商品</button>
      </div>

      {loading ? (
        <div className="loading">加载中…</div>
      ) : products.length === 0 ? (
        <div className="ecom-empty">
          <div className="ecom-empty-icon">📦</div>
          <p>还没有商品，先创建一个吧</p>
          <button className="primary" onClick={() => setShowForm(true)}>+ 新建商品</button>
        </div>
      ) : (
        <div className="ecom-grid">
          {products.map((p) => (
            <button key={p.id} className="ecom-card" onClick={() => openDetail(p.id)}>
              <div className="ecom-card-name">{p.productName}</div>
              <div className="ecom-card-meta">
                {p.category ? <span className="ecom-tag">{p.category}</span> : null}
                {p.targetMarket ? <span className="ecom-tag">{p.targetMarket}</span> : null}
                <span className="ecom-muted">{p._count?.listings ?? 0} Listing · {p._count?.assets ?? 0} 素材</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="ecom-detail">
          <div className="ecom-detail-head">
            <h2>{selected.productName}</h2>
            <button className="ecom-close" onClick={() => { setSelected(null); setEnriched(null); }} aria-label="关闭详情">×</button>
          </div>

          <div className="ecom-fields">
            <div className="ecom-field"><label>类别</label><span>{selected.category || '—'}</span></div>
            <div className="ecom-field"><label>品牌</label><span>{selected.brand || '—'}</span></div>
            <div className="ecom-field"><label>目标市场</label><span>{selected.targetMarket || '—'}</span></div>
            <div className="ecom-field"><label>平台</label><span>{selected.platform || '—'}</span></div>
          </div>

          {selected.sourceDescription ? (
            <div className="ecom-desc"><label>原始描述</label><p>{selected.sourceDescription}</p></div>
          ) : null}

          {Array.isArray(selected.features) && selected.features.length > 0 ? (
            <div className="ecom-list-block"><label>卖点 / 特性</label><ul>{selected.features.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
          ) : null}

          {Array.isArray(selected.specifications) && selected.specifications.length > 0 ? (
            <div className="ecom-list-block"><label>规格参数</label><ul>{selected.specifications.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
          ) : null}

          {Array.isArray(selected.materials) && selected.materials.length > 0 ? (
            <div className="ecom-list-block"><label>材质</label><ul>{selected.materials.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
          ) : null}

          <button className="ecom-enrich-btn" onClick={runEnrich} disabled={enriching}>
            {enriching ? 'AI 提取中…' : '✨ AI 提取商品资料'}
          </button>

          {enriched ? (
            <div className="ecom-enrich-result">
              <div className="ecom-enrich-title">✨ AI 提取结果</div>
              {enriched.category ? <div className="ecom-enrich-row"><label>类别</label><span>{enriched.category}</span></div> : null}
              {enriched.brand ? <div className="ecom-enrich-row"><label>品牌</label><span>{enriched.brand}</span></div> : null}
              {enriched.targetMarket ? <div className="ecom-enrich-row"><label>目标市场</label><span>{enriched.targetMarket}</span></div> : null}
              {Array.isArray(enriched.features) && enriched.features.length > 0 ? (
                <div className="ecom-enrich-row"><label>卖点</label><span>{enriched.features.join('、')}</span></div>
              ) : null}
              {Array.isArray(enriched.keywords) && enriched.keywords.length > 0 ? (
                <div className="ecom-enrich-row"><label>关键词</label><span>{enriched.keywords.join('、')}</span></div>
              ) : null}
              {Array.isArray(enriched.sellingPoints) && enriched.sellingPoints.length > 0 ? (
                <div className="ecom-enrich-row"><label>差异化卖点</label><span>{enriched.sellingPoints.join('、')}</span></div>
              ) : null}
              {Array.isArray(enriched.needConfirm) && enriched.needConfirm.length > 0 ? (
                <div className="ecom-need-confirm">
                  <label>⚠️ 需你确认</label>
                  <ul>{enriched.needConfirm.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <ListingStudio productId={selected.id} />
        </div>
      )}

      {showForm ? (
        <div className="ecom-mask" onClick={() => setShowForm(false)}>
          <div className="ecom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ecom-modal-head">
              <h3>新建商品</h3>
              <button className="ecom-close" onClick={() => setShowForm(false)} aria-label="关闭">×</button>
            </div>
            <form onSubmit={createProduct}>
              <label className="ecom-label">商品名称 *</label>
              <input className="ecom-input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="如：便携式蓝牙音箱" maxLength={120} />
              <label className="ecom-label">商品描述（可选）</label>
              <textarea className="ecom-input ecom-textarea" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="描述商品的功能、材质、适用场景等，AI 会据此提取卖点" rows={4} />
              <div className="ecom-modal-actions">
                <button type="button" className="ecom-btn-ghost" onClick={() => setShowForm(false)}>取消</button>
                <button type="submit" className="primary" disabled={formBusy || !formName.trim()}>{formBusy ? '创建中…' : '创建商品'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {creditModal ? (
        <div className="ecom-mask" onClick={() => setCreditModal(null)}>
          <div className="ecom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ecom-modal-head"><h3>额度不足</h3></div>
            <p className="ecom-credit-text">本次预计需要 <b>{creditModal.estimated}</b> 额度，当前可用 <b>{creditModal.available}</b> 额度。</p>
            <div className="ecom-modal-actions">
              <button className="ecom-btn-ghost" onClick={() => setCreditModal(null)}>取消</button>
              <a className="primary" href="/credit">获取额度</a>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
