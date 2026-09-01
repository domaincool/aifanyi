'use client';

import { useState, useEffect, useCallback } from 'react';

interface CustomerMessage {
  id: string;
  sourceText: string;
  sourceLang: string;
  translation?: string | null;
  intent?: string | null;
  replyJson?: { reply: string; tone: string } | null;
  tone?: string | null;
  createdAt: string;
}

const SOURCE_LANGS = [
  { code: 'auto', label: '自动检测' },
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'es', label: '西班牙语' },
];

const TONES = [
  { code: 'professional', label: '专业正式' },
  { code: 'friendly', label: '亲切友好' },
  { code: 'concise', label: '简洁直接' },
];

const toneLabel = (t?: string | null) => TONES.find((t0) => t0.code === t)?.label || t || '';

export default function CustomerAssistant({ productId }: { productId: string }) {
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [busy, setBusy] = useState<'submit' | 'translate' | 'reply' | 'retone' | null>(null);
  const [creditModal, setCreditModal] = useState<{ estimated: number; available: number } | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const selected = messages.find((m) => m.id === selectedId) || null;

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/ecommerce/products/${productId}/messages`);
      const data = await res.json();
      if (data.ok) {
        setMessages(data.messages || []);
        if (!selectedId && data.messages?.length) setSelectedId(data.messages[0].id);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, [productId, selectedId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const call = async (path: string, method: string, body?: any) => {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };

  const submit = async () => {
    if (!sourceText.trim() || busy) return;
    setBusy('submit');
    const r = await call(`/api/ecommerce/products/${productId}/messages`, 'POST', { sourceText, sourceLang });
    if (r.json.ok) {
      setSourceText('');
      await loadMessages();
      setSelectedId(r.json.message?.id || null);
      showToast('客户消息已录入');
    } else {
      showToast(r.json.error || '录入失败');
    }
    setBusy(null);
  };

  const translate = async () => {
    if (!selected || busy) return;
    setBusy('translate');
    const r = await call(`/api/ecommerce/messages/${selected.id}/translate`, 'POST');
    if (r.json.ok) {
      showToast('已翻译');
      await loadMessages();
    } else if (r.json.code === 'insufficient') {
      setCreditModal({ estimated: r.json.estimated ?? 0, available: r.json.available ?? 0 });
    } else {
      showToast(r.json.error || '翻译失败');
    }
    setBusy(null);
  };

  const reply = async () => {
    if (!selected || busy) return;
    setBusy('reply');
    const r = await call(`/api/ecommerce/messages/${selected.id}/reply`, 'POST');
    if (r.json.ok) {
      showToast('回复已生成');
      await loadMessages();
    } else if (r.json.code === 'insufficient') {
      setCreditModal({ estimated: r.json.estimated ?? 0, available: r.json.available ?? 0 });
    } else {
      showToast(r.json.error || '生成回复失败');
    }
    setBusy(null);
  };

  const retone = async (tone: string) => {
    if (!selected || busy) return;
    setBusy('retone');
    const r = await call(`/api/ecommerce/messages/${selected.id}/retone`, 'POST', { tone });
    if (r.json.ok) {
      showToast(`语气已调整为「${toneLabel(tone)}」`);
      await loadMessages();
    } else if (r.json.code === 'insufficient') {
      setCreditModal({ estimated: r.json.estimated ?? 0, available: r.json.available ?? 0 });
    } else {
      showToast(r.json.error || '重写失败');
    }
    setBusy(null);
  };

  const copyReply = async () => {
    if (!selected?.replyJson?.reply) return;
    try {
      await navigator.clipboard.writeText(selected.replyJson.reply);
      showToast('回复已复制到剪贴板');
    } catch { showToast('复制失败，请手动选择复制'); }
  };

  return (
    <div className="ecom-cs">
      <div className="ecom-listing-head">
        <h3>客户助手</h3>
        <span className="ecom-muted">翻译客户消息 · AI 回复建议 · 语气调整</span>
      </div>

      <div className="ecom-cs-input">
        <textarea
          className="ecom-textarea"
          placeholder="粘贴海外客户发来的消息…"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={3}
        />
        <div className="ecom-cs-input-row">
          <select className="ecom-select" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
            {SOURCE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button className="primary" onClick={submit} disabled={busy === 'submit' || !sourceText.trim()}>
            {busy === 'submit' ? '录入中…' : '录入消息'}
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="ecom-muted-line">加载中…</div>
      ) : messages.length === 0 ? (
        <div className="ecom-muted-line">还没有客户消息，录入后即可翻译并生成回复</div>
      ) : (
        <div className="ecom-cs-body">
          <div className="ecom-cs-list">
            {messages.map((m) => (
              <button key={m.id} className={`ecom-cs-item ${selectedId === m.id ? 'ecom-cs-active' : ''}`} onClick={() => setSelectedId(m.id)}>
                <span className="ecom-cs-preview">{m.sourceText.slice(0, 60)}{m.sourceText.length > 60 ? '…' : ''}</span>
                {m.intent ? <span className="ecom-cs-badge">{m.intent}</span> : null}
              </button>
            ))}
          </div>

          {selected ? (
            <div className="ecom-cs-detail">
              <div className="ecom-cs-block">
                <div className="ecom-cs-label">客户原文（{SOURCE_LANGS.find((l) => l.code === selected.sourceLang)?.label || selected.sourceLang}）</div>
                <div className="ecom-cs-text">{selected.sourceText}</div>
              </div>

              <button className="ecom-enrich-btn" onClick={translate} disabled={busy !== null}>
                {busy === 'translate' ? '翻译中…' : '🌐 翻译成中文 + 识别意图'}
              </button>

              {selected.translation ? (
                <div className="ecom-cs-block">
                  <div className="ecom-cs-label">中文翻译 {selected.intent ? <span className="ecom-cs-badge">{selected.intent}</span> : null}</div>
                  <div className="ecom-cs-text">{selected.translation}</div>
                </div>
              ) : null}

              <button className="ecom-enrich-btn" onClick={reply} disabled={busy !== null}>
                {busy === 'reply' ? '生成中…' : '✨ 生成回复建议'}
              </button>

              {selected.replyJson?.reply ? (
                <div className="ecom-cs-block ecom-cs-reply">
                  <div className="ecom-cs-label">AI 回复（{toneLabel(selected.tone)}）</div>
                  <div className="ecom-cs-text">{selected.replyJson.reply}</div>
                  <div className="ecom-cs-actions">
                    <div className="ecom-cs-tones">
                      {TONES.map((t) => (
                        <button
                          key={t.code}
                          className={`ecom-tone-btn ${selected.tone === t.code ? 'ecom-tone-active' : ''}`}
                          onClick={() => retone(t.code)}
                          disabled={busy !== null}
                        >
                          {busy === 'retone' && selected.tone !== t.code ? '…' : t.label}
                        </button>
                      ))}
                    </div>
                    <button className="ecom-btn-ghost" onClick={copyReply}>复制回复</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

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
