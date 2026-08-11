'use client';

import { useState } from 'react';

const LANGS = [
  { v: 'zh', label: '简体中文' },
  { v: 'en', label: 'English' },
  { v: 'ja', label: '日本語' },
  { v: 'ko', label: '한국어' },
  { v: 'fr', label: 'Français' },
  { v: 'de', label: 'Deutsch' },
  { v: 'es', label: 'Español' },
];

type Phase = 'input' | 'working' | 'done' | 'error';

export default function WebTranslatorClient() {
  const [url, setUrl] = useState('');
  const [targetLang, setTargetLang] = useState('zh');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }

  async function translate() {
    const u = url.trim();
    if (!u) { setError('请输入网页地址'); setPhase('error'); return; }
    setError(''); setPhase('working'); setProgressMsg('正在抓取网页内容…');
    try {
      const res = await fetch('/api/web/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u, targetLang }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || '翻译失败'); setPhase('error'); return; }
      setTitle(data.title); setParagraphs(data.paragraphs); setTranslations(data.translations);
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || '网络错误，请重试'); setPhase('error');
    }
  }

  async function copyAll() {
    const text = paragraphs.map((p, i) => `【原文】${p}\n【译文】${translations[i] || ''}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制 📋');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('已复制 📋');
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* 输入区 */}
      {phase !== 'done' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') translate(); }}
              placeholder="粘贴网页地址，如 https://en.wikipedia.org/wiki/Artificial_intelligence"
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 10, fontSize: 14, outline: 'none',
                background: 'var(--input-bg)', color: 'var(--text)', border: `1px solid ${error ? 'var(--danger)' : 'var(--input-border)'}`,
              }}
            />
            <select
              value={targetLang}
              onChange={e => setTargetLang(e.target.value)}
              disabled={phase === 'working'}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14 }}
            >
              {LANGS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>支持大部分静态网页（新闻/博客/文档）；JS 渲染页面可能提取不到正文</span>
            <button className="btn-primary" onClick={translate} disabled={phase === 'working'}
              style={{ padding: '10px 28px', fontSize: 15, opacity: phase === 'working' ? .6 : 1 }}>
              {phase === 'working' ? '翻译中…' : '🌐 翻译网页'}
            </button>
          </div>
          {phase === 'working' && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>{progressMsg} 大页面可能需要 30-60 秒</p>}
        </div>
      )}

      {phase === 'error' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--danger)', borderRadius: 16, padding: 20, color: 'var(--danger)', marginTop: 16 }}>
          <p style={{ margin: 0 }}>⚠️ {error}</p>
        </div>
      )}

      {/* 结果 */}
      {phase === 'done' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>{title || '网页内容'}</div>
              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>{url}</a>
            </div>
            <button className="btn-primary" onClick={copyAll} style={{ padding: '8px 18px' }}>📋 复制双语全文</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }} onClick={() => { setPhase('input'); setParagraphs([]); setTranslations([]); setTitle(''); }}>
              翻译其他网页 →
            </button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--panel)', maxHeight: 640, overflowY: 'auto' }}>
            {paragraphs.map((p, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 4 }}>{p}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{translations[i] || p}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--toast-bg)', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, zIndex: 999 }}>{toast}</div>}
    </div>
  );
}
