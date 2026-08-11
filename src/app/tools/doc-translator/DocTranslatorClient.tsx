'use client';

import { useRef, useState } from 'react';

const LANGS = [
  { v: 'zh', label: '简体中文' },
  { v: 'en', label: 'English' },
  { v: 'ja', label: '日本語' },
  { v: 'ko', label: '한국어' },
  { v: 'fr', label: 'Français' },
  { v: 'de', label: 'Deutsch' },
  { v: 'es', label: 'Español' },
];

interface Para { kind: string; source: string; text: string; }
type Phase = 'upload' | 'working' | 'done' | 'error';

export default function DocTranslatorClient() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileName, setFileName] = useState('');
  const [targetLang, setTargetLang] = useState('zh');
  const [paragraphs, setParagraphs] = useState<Para[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }

  async function upload(file: File) {
    if (!/\.(docx?|pptx?)$/i.test(file.name)) {
      setError('仅支持 Word(.docx) / PPT(.pptx) 文件。'); setPhase('error'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('文件过大（限 10MB）。'); setPhase('error'); return;
    }
    setError(''); setFileName(file.name); setPhase('working');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetLang', targetLang);
    try {
      const res = await fetch('/api/doc/translate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) { setError(data.error || '翻译失败'); setPhase('error'); return; }
      setParagraphs(data.paragraphs); setTranslations(data.translations);
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || '网络错误，请重试'); setPhase('error');
    }
  }

  async function copyAll() {
    const text = paragraphs.map((p, i) => `${p.source}：${p.text}\n译文：${translations[i] || ''}`).join('\n\n');
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

  const kindLabel: Record<string, string> = { heading: '标题', paragraph: '段落', list: '列表', table: '表格', slide: '幻灯片' };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, color: 'var(--muted)' }}>翻译为：</label>
        <select
          value={targetLang}
          onChange={e => setTargetLang(e.target.value)}
          disabled={phase === 'working'}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14 }}
        >
          {LANGS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </div>

      {phase === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 16, padding: '56px 24px', textAlign: 'center', cursor: 'pointer',
            background: 'var(--panel)', transition: 'border-color .15s',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <p style={{ fontSize: 16, margin: '0 0 6px' }}>点击或拖拽 Word / PPT 文件到这里</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>支持 .docx / .pptx · 最大 10MB · 单文件最多 300 段 · 免费使用</p>
          <input ref={inputRef} type="file" accept=".docx,.pptx,.doc,.ppt" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </div>
      )}

      {phase === 'working' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>正在提取文档文字并翻译…（大文档可能需要 30-60 秒）</p>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--danger)', borderRadius: 16, padding: 24, color: 'var(--danger)' }}>
          <p style={{ margin: '0 0 12px' }}>⚠️ {error}</p>
          <button className="btn-primary" style={{ padding: '8px 18px' }} onClick={() => { setPhase('upload'); setError(''); }}>
            重新上传
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{fileName}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>已翻译 {paragraphs.length} 段</span>
            <button className="btn-primary" onClick={copyAll} style={{ padding: '8px 18px', marginLeft: 'auto' }}>📋 复制双语全文</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }} onClick={() => { setPhase('upload'); setParagraphs([]); setTranslations([]); setFileName(''); }}>
              翻译其他文档 →
            </button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--panel)', maxHeight: 640, overflowY: 'auto' }}>
            {paragraphs.map((p, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{kindLabel[p.kind] || p.kind} · {p.source}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 4 }}>{p.text}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{translations[i] || p.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--toast-bg)', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, zIndex: 999 }}>{toast}</div>}
    </div>
  );
}
