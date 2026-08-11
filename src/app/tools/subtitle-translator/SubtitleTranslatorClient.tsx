'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Cue {
  index: number;
  start: string;
  end: string;
  text: string;
  translation?: string;
}

type Phase = 'upload' | 'working' | 'done' | 'error';

const LANG_OPTIONS = [
  { v: 'zh', label: '简体中文' },
  { v: 'en', label: 'English' },
  { v: 'ja', label: '日本語' },
  { v: 'ko', label: '한국어' },
  { v: 'fr', label: 'Français' },
  { v: 'de', label: 'Deutsch' },
  { v: 'es', label: 'Español' },
];

export default function SubtitleTranslatorClient() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileName, setFileName] = useState('');
  const [targetLang, setTargetLang] = useState('zh');
  const [progress, setProgress] = useState(0);
  const [translated, setTranslated] = useState(0);
  const [total, setTotal] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const upload = useCallback(async (file: File) => {
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      setError('仅支持 SRT / VTT 字幕文件。'); setPhase('error'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('文件过大（限 5MB）。'); setPhase('error'); return;
    }
    setError(''); setFileName(file.name); setPhase('working'); setProgress(0); setTranslated(0); setTotal(0);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetLang', targetLang);
    try {
      const res = await fetch('/api/subtitle/translate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) { setError(data.error || '上传失败'); setPhase('error'); return; }
      setTotal(data.totalCues);
      poll(data.taskId);
    } catch (e: any) {
      setError(e?.message || '网络错误，请重试'); setPhase('error');
    }
  }, [targetLang]);

  const poll = useCallback((taskId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/subtitle/tasks/${taskId}`);
        const data = await res.json();
        if (!data.ok) { setError(data.error || '任务查询失败'); setPhase('error'); if (timerRef.current) clearInterval(timerRef.current); return; }
        setProgress(data.task.progress);
        setTranslated(data.task.translatedCues);
        if (data.task.status === 'completed') {
          if (timerRef.current) clearInterval(timerRef.current);
          setCues(data.cues || []);
          setPhase('done');
        } else if (data.task.status === 'failed') {
          if (timerRef.current) clearInterval(timerRef.current);
          setError(data.task.errorMessage || '翻译失败'); setPhase('error');
        }
      } catch { /* 网络抖动，下轮重试 */ }
    }, 1500);
  }, []);

  const download = useCallback((content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, []);

  const buildSrt = (bilingual: boolean) => {
    return cues.map(c => {
      const s = c.start.replace('.', ',');
      const e = c.end.replace('.', ',');
      const lines = [String(c.index), `${s} --> ${e}`];
      if (bilingual && c.translation && c.translation !== c.text) {
        lines.push(c.text); lines.push(c.translation);
      } else {
        lines.push(c.translation || c.text);
      }
      return lines.join('\n');
    }).join('\n\n') + '\n';
  };

  const exportSrt = (bilingual: boolean) => {
    setExporting(true);
    const base = fileName.replace(/\.(srt|vtt)$/i, '');
    download(buildSrt(bilingual), `${base}${bilingual ? '.双语' : ''}.srt`, 'text/plain;charset=utf-8');
    setTimeout(() => setExporting(false), 500);
  };

  const exportTxt = () => {
    setExporting(true);
    const base = fileName.replace(/\.(srt|vtt)$/i, '');
    const txt = cues.map(c => `[${fmtTime(c.start)}] ${c.text}\n${c.translation && c.translation !== c.text ? c.translation : ''}`).join('\n');
    download(txt, `${base}.txt`, 'text/plain;charset=utf-8');
    setTimeout(() => setExporting(false), 500);
  };

  const fmtTime = (t: string) => t.replace(',', '.').replace(/^00:/, '');

  return (
    <div className="subtitle-translator" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, color: 'var(--muted)' }}>翻译为：</label>
        <select
          value={targetLang}
          onChange={e => setTargetLang(e.target.value)}
          disabled={phase === 'working'}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14 }}
        >
          {LANG_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
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
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <p style={{ fontSize: 16, margin: '0 0 6px' }}>点击或拖拽字幕文件到这里</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>支持 SRT / VTT · 最大 5MB · 单文件最多 2000 条 · 每日免费 5 个文件</p>
          <input ref={inputRef} type="file" accept=".srt,.vtt" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </div>
      )}

      {phase === 'working' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)' }}>正在翻译《{fileName}》…（{translated}/{total} 条）</p>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width .5s' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>{progress}% · 通常 30 秒内完成，请勿关闭页面</p>
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
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-primary" onClick={() => exportSrt(true)} disabled={exporting}>⬇ 双语 SRT</button>
            <button className="btn-primary" style={{ background: 'var(--panel)', color: 'var(--text)' }} onClick={() => exportSrt(false)} disabled={exporting}>⬇ 纯译文 SRT</button>
            <button className="btn-primary" style={{ background: 'var(--panel)', color: 'var(--text)' }} onClick={exportTxt} disabled={exporting}>⬇ TXT</button>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>已翻译 {cues.length} 条 · 译文在服务端保留 24 小时</span>
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }} onClick={() => { setPhase('upload'); setCues([]); setFileName(''); }}>
              翻译下一个 →
            </button>
          </div>
          <div style={{ maxHeight: 560, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--panel)' }}>
            {cues.map(c => (
              <div key={c.index} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '88px 1fr 1fr', gap: 12, alignItems: 'start' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{fmtTime(c.start)}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>{c.text}</div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>{c.translation || c.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
