'use client';

import { useState } from 'react';

const LANGS = [
  { v: 'zh', label: '中文' },
  { v: 'en', label: 'English' },
  { v: 'ja', label: '日本語' },
  { v: 'ko', label: '한국어' },
  { v: 'fr', label: 'Français' },
  { v: 'de', label: 'Deutsch' },
  { v: 'es', label: 'Español' },
  { v: 'ru', label: 'Русский' },
  { v: 'ar', label: 'العربية' },
  { v: 'pt', label: 'Português' },
];

const EXAMPLES: Record<string, string> = {
  zh: '这个产品的功能很强大，使用起来非常方便，我觉得用户会很喜欢。',
  en: 'The product has many features and it is easy to use. I think users will like it a lot.',
  ja: 'この商品は機能が多くて、使いやすいです。ユーザーに喜ばれると思います。',
};

export default function PolishClient() {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('zh');
  const [result, setResult] = useState('');
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }

  async function doPolish() {
    const t = text.trim();
    if (!t) { setError('请输入要润色的文字'); return; }
    setError(''); setLoading(true); setResult(''); setMeta(''); setShowOriginal(false);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t, sourceLang: lang, targetLang: lang, scenario: 'general', polish: true }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.text);
        setMeta(`模型：${data.model}${data.cached ? '（缓存命中）' : ''} · ${data.latencyMs || 0}ms`);
        showToast('润色完成 ✨');
      }
    } catch (e: any) {
      setError(e?.message || '网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result);
      showToast('已复制 📋');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = result; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('已复制 📋');
    }
  }

  return (
    <div className="translator-box" style={{ maxWidth: 960, margin: '20px auto' }}>
      {/* 语言选择 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, color: 'var(--muted)' }}>语言：</label>
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          disabled={loading}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14 }}
        >
          {LANGS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <button
          className="btn-primary"
          style={{ padding: '7px 14px', fontSize: 13, background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8 }}
          onClick={() => { setText(EXAMPLES[lang] || EXAMPLES.zh); setError(''); }}
        >填入示例</button>
      </div>

      {/* 输入 */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="粘贴需要润色的译文或草稿，比如：这个产品的功能很强大，使用起来非常方便…"
        maxLength={5000}
        rows={6}
        style={{
          width: '100%', padding: 14, borderRadius: 10, fontSize: 15, lineHeight: 1.7, resize: 'vertical',
          background: 'var(--input-bg)', color: 'var(--text)', border: `1px solid ${error ? 'var(--danger)' : 'var(--input-border)'}`, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{text.length}/5000</span>
        <button className="btn-primary" onClick={doPolish} disabled={loading || !text.trim()}
          style={{ padding: '10px 28px', fontSize: 15, opacity: loading || !text.trim() ? .6 : 1 }}>
          {loading ? '润色中…' : '✨ 开始润色'}
        </button>
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>⚠️ {error}</p>}

      {/* 结果卡片 */}
      {result && (
        <div className="result-card" style={{ marginTop: 18 }}>
          <div className="result-head">
            <span>{meta}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-google-sm" onClick={() => setShowOriginal(v => !v)}>原文对照</button>
              <button className="btn-google-sm" onClick={() => { setResult(''); setMeta(''); setShowOriginal(false); }}>清空</button>
            </div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            {showOriginal && text.trim() && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', color: 'var(--muted)', fontSize: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--muted)' }}>原文</div>
                {text.trim()}
              </div>
            )}
            <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{result}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-google-sm" onClick={copy}>📋 复制</button>
              <button className="btn-google-sm" onClick={() => { setText(result); setResult(''); setShowOriginal(false); }}>继续润色</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast" style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--toast-bg)', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, zIndex: 999 }}>{toast}</div>}
    </div>
  );
}
