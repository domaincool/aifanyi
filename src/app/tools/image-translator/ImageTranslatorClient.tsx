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

type Phase = 'upload' | 'working' | 'done' | 'error';

export default function ImageTranslatorClient() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [preview, setPreview] = useState('');
  const [fileName, setFileName] = useState('');
  const [targetLang, setTargetLang] = useState('zh');
  const [ocrText, setOcrText] = useState('');
  const [translation, setTranslation] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }

  async function upload(file: File) {
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      setError('仅支持 PNG / JPG / WebP / GIF 图片。'); setPhase('error'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('图片过大（限 5MB）。'); setPhase('error'); return;
    }
    setError(''); setFileName(file.name); setPhase('working'); setOcrText(''); setTranslation(''); setModel('');
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetLang', targetLang);
    try {
      const res = await fetch('/api/image/translate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) { setError(data.error || '识别失败'); setPhase('error'); return; }
      setOcrText(data.text);
      setTranslation(data.translation);
      setModel(data.model);
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || '网络错误，请重试'); setPhase('error');
    }
  }

  async function copy(text: string) {
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
          <div style={{ fontSize: 40, marginBottom: 12 }}>🖼</div>
          <p style={{ fontSize: 16, margin: '0 0 6px' }}>点击或拖拽图片到这里</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>支持 PNG / JPG / WebP / GIF · 最大 5MB · 截图、海报、菜单、聊天记录均可</p>
          <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </div>
      )}

      {phase === 'working' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>正在识别图片文字并翻译…（约 10-20 秒）</p>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--danger)', borderRadius: 16, padding: 24, color: 'var(--danger)' }}>
          <p style={{ margin: '0 0 12px' }}>⚠️ {error}</p>
          <button className="btn-primary" style={{ padding: '8px 18px' }} onClick={() => { setPhase('upload'); setError(''); setPreview(''); }}>
            重新上传
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)', gap: 16 }}>
          {/* 左：图片 */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, alignSelf: 'start' }}>
            <img src={preview} alt="上传的图片" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
              <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }} onClick={() => { setPhase('upload'); setPreview(''); }}>
                换一张 →
              </button>
            </div>
          </div>
          {/* 右：识别 + 译文 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
                <span>识别文字</span>
                <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }} onClick={() => copy(ocrText)}>复制</button>
              </div>
              <div style={{ padding: 14, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text)', maxHeight: 220, overflowY: 'auto' }}>{ocrText}</div>
            </div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--accent)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
                <span>译文 · 模型：{model}</span>
                <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }} onClick={() => copy(translation)}>复制</button>
              </div>
              <div style={{ padding: 14, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text)', maxHeight: 220, overflowY: 'auto' }}>{translation}</div>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--toast-bg)', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, zIndex: 999 }}>{toast}</div>}
    </div>
  );
}
