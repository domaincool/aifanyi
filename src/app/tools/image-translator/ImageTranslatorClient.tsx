'use client';

import { useRef, useState } from 'react';
import { FAIR_USE_PAUSED_MSG, isCreditDeductionEnabled } from '@/lib/credit/feature-flags';

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

// D：面向用户的积分提示只允许两种写法——「预计使用 X 积分」/「本次使用 X 积分」；扣费总开关关闭时不渲染
const FREE_STAGE = (() => { try { return !isCreditDeductionEnabled(); } catch { return true; } })();
const creditNote = (credits?: number) => (FREE_STAGE ? FAIR_USE_PAUSED_MSG : (typeof credits === 'number' && credits > 0 ? `本次使用 ${credits} 积分` : ''));

export default function ImageTranslatorClient() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [preview, setPreview] = useState('');
  const [fileName, setFileName] = useState('');
  const [targetLang, setTargetLang] = useState('zh');
  const [ocrText, setOcrText] = useState('');
  const [translation, setTranslation] = useState('');
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }

  // compressImage: canvas re-encode to JPEG, longest edge ~2000px / q0.85.
  // Handles 6MB+ phone shots and HEIC (Safari decodes HEIC via createImageBitmap/Image, then we re-encode to JPEG).
  async function compressImage(file: File): Promise<File> {
    if (typeof document === "undefined") return file;
    const img = new Image();
    const url = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = url;
      });
      let w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return file;
      const MAX = 2000;
      if (w <= MAX && h <= MAX && file.size <= 4 * 1024 * 1024 && /image\/(jpeg|png)/.test(file.type)) return file; // small enough, keep original
      const scale = Math.min(1, MAX / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // flatten transparency onto white for JPEG
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
      if (!blob || blob.size >= file.size) return file; // compression did not help, keep original
      const base = file.name.replace(/\.[^.]+\$/, "") || "photo";
      return new File([blob], base + ".jpg", { type: "image/jpeg" });
    } catch {
      return file; // decode failure (e.g. unsupported): let the server respond with its own error
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function upload(rawFile: File) {
    let file = rawFile;
    if (!(file.type || '').startsWith('image/') && !/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name)) {
      setError('\u4ec5\u652f\u6301\u56fe\u7247\u6587\u4ef6\u3002'); setPhase('error'); return;
    }
    try { file = await compressImage(file); } catch {}
    if (file.size > 5 * 1024 * 1024) {
      setError('图片过大（限 5MB）。'); setPhase('error'); return;
    }
    setError(''); setFileName(file.name); setPhase('working'); setOcrText(''); setTranslation(''); setModel(''); setCredits(undefined);
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
      // D：积分数值一律来自服务端返回，前端不自行计算
      setCredits(typeof data.credits === 'number' ? data.credits : undefined);
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
          {/* A8：图片翻译需登录 */}
          <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 6px' }}>需登录使用</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>支持 PNG / JPG / WebP / GIF · 最大 5MB · 截图、海报、菜单、聊天记录均可</p>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <div className="cam-row" style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" className="btn-primary" style={{ padding: "10px 22px", display: "none" }} data-cam-btn onClick={() => cameraRef.current?.click()}>馃摳 拍照翻译</button>
            <button type="button" style={{ padding: "10px 22px" }} onClick={() => inputRef.current?.click()}>相册选图</button>
          </div>
          <style dangerouslySetInnerHTML={{ __html: "@media (pointer: coarse){ [data-cam-btn]{ display: inline-flex !important; } }" }} />
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
            {/* D：结果区积分口径（数值来自服务端；扣费关闭时不渲染） */}
            {creditNote(credits) && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{creditNote(credits)}</div>}
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
