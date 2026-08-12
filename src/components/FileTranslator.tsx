'use client';

import { useCallback, useRef, useState } from 'react';

type FileType = 'pdf' | 'image' | 'subtitle' | 'doc';
type Phase = 'idle' | 'working' | 'done' | 'error';

interface DocPair { source: string; text: string; translation: string; }
interface ImageResult { text: string; translation: string; preview: string; }
interface SubtitleCue { index: number; start: string; end: string; text: string; translation?: string; }

const ACCEPT: Record<FileType, string> = {
  pdf: '.pdf',
  image: '.png,.jpg,.jpeg,.webp,.gif',
  subtitle: '.srt,.vtt',
  doc: '.docx,.pptx,.doc,.ppt',
};
const SIZE_LIMIT: Record<FileType, number> = {
  pdf: 20 * 1024 * 1024,
  image: 5 * 1024 * 1024,
  subtitle: 5 * 1024 * 1024,
  doc: 10 * 1024 * 1024,
};
const TOOL_URL: Record<FileType, string> = {
  pdf: '/tools/pdf-translator',
  image: '/tools/image-translator',
  subtitle: '/tools/subtitle-translator',
  doc: '/tools/doc-translator',
};
const TYPE_LABEL: Record<FileType, string> = { pdf: 'PDF', image: '图片', subtitle: '字幕', doc: '文档' };

function detectType(name: string): FileType | null {
  const n = name.toLowerCase();
  if (/\.pdf$/.test(n)) return 'pdf';
  if (/\.(png|jpe?g|webp|gif)$/.test(n)) return 'image';
  if (/\.(srt|vtt)$/.test(n)) return 'subtitle';
  if (/\.(docx?|pptx?)$/.test(n)) return 'doc';
  return null;
}

export default function FileTranslator({ targetLang }: { targetLang: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileType, setFileType] = useState<FileType>('pdf');
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [pairs, setPairs] = useState<DocPair[]>([]);
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };
  const reset = () => { if (pollTimer.current) clearTimeout(pollTimer.current); setPhase('idle'); setError(''); setPairs([]); setImageResult(null); setSubtitleCues([]); setProgress(0); };

  // 统一结果卡片：段落对照
  const renderPairs = (items: DocPair[], limit: number, toolBtn: boolean) => (
    <div className="file-result">
      <div className="file-result-head">
        <span>{TYPE_LABEL[fileType]}翻译完成 ✓</span>
        <div className="file-result-actions">
          <button type="button" className="btn-google-sm" onClick={() => copyPairs(items)}>📋 复制全文</button>
          <a className="btn-google-sm" href={TOOL_URL[fileType]} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>完整工具 →</a>
        </div>
      </div>
      <div className="file-pairs">
        {items.slice(0, limit).map((p, i) => (
          <div className="file-pair" key={i}>
            <div className="file-pair-src">{p.text}</div>
            <div className="file-pair-dst">{p.translation}</div>
          </div>
        ))}
      </div>
      {items.length > limit && <div className="file-more">仅显示前 {limit} 段，共 {items.length} 段 · <a href={TOOL_URL[fileType]} style={{ color: 'var(--accent)' }}>打开完整工具查看全部</a></div>}
    </div>
  );

  async function copyPairs(items: DocPair[]) {
    const text = items.map(p => `${p.text}\n${p.translation}`).join('\n\n');
    try { await navigator.clipboard.writeText(text); showToast('已复制'); }
    catch { showToast('复制失败'); }
  }

  const upload = useCallback(async (file: File) => {
    const type = detectType(file.name);
    if (!type) { setError('暂不支持该文件类型，支持：PDF / 图片 / SRT·VTT 字幕 / Word·PPT'); setPhase('error'); return; }
    if (file.size > SIZE_LIMIT[type]) { setError(`文件过大（${TYPE_LABEL[type]} 上限 ${Math.round(SIZE_LIMIT[type] / 1024 / 1024)}MB）。`); setPhase('error'); return; }
    setFileType(type); setFileName(file.name); setPhase('working'); setError(''); setProgress(0);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetLang', targetLang);

    try {
      if (type === 'image') {
        const res = await fetch('/api/image/translate', { method: 'POST', body: fd });
        const d = await res.json();
        if (!d.ok) { setError(d.error || '识别失败'); setPhase('error'); return; }
        setImageResult({ text: d.text, translation: d.translation, preview: URL.createObjectURL(file) });
        setPhase('done');
        return;
      }
      if (type === 'doc') {
        const res = await fetch('/api/doc/translate', { method: 'POST', body: fd });
        const d = await res.json();
        if (!d.ok) { setError(d.error || '翻译失败'); setPhase('error'); return; }
        setPairs((d.paragraphs || []).map((p: any, i: number) => ({ source: p.source, text: p.text, translation: d.translations[i] || p.text })));
        setPhase('done');
        return;
      }
      // PDF / 字幕：异步任务轮询
      const api = type === 'pdf' ? '/api/pdf/translate' : '/api/subtitle/translate';
      const res = await fetch(api, { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || (!d.taskId && d.error)) { setError(d.message || d.error || '上传失败'); setPhase('error'); return; }
      const taskId = d.taskId;
      const poll = async () => {
        try {
          const tr = await fetch(type === 'pdf' ? `/api/pdf/tasks/${taskId}` : `/api/subtitle/tasks/${taskId}`);
          const td = await tr.json();
          const status = type === 'pdf' ? td.status : td.task?.status;
          const pct = type === 'pdf' ? td.progress : td.task?.progress;
          setProgress(pct || 0);
          if (status === 'completed' || status === 'done') {
            if (type === 'pdf') {
              const pages = td.result?.pages || [];
              const items: DocPair[] = [];
              for (const pg of pages) {
                for (const b of pg.blocks || []) {
                  const trText = b.translations?.deepseek || b.text;
                  if (b.type === 'header' || b.type === 'footer' || b.type === 'image') continue;
                  items.push({ source: `第${pg.pageNumber}页`, text: b.text, translation: trText });
                }
              }
              setPairs(items);
            } else {
              setSubtitleCues(td.cues || []);
            }
            setProgress(100);
            setPhase('done');
          } else if (status === 'failed' || status === 'error') {
            setError((td.errorMessage || td.message) || '翻译失败，请重试'); setPhase('error');
          } else {
            pollTimer.current = setTimeout(poll, 1500);
          }
        } catch {
          pollTimer.current = setTimeout(poll, 3000);
        }
      };
      poll();
    } catch (e: any) {
      setError(e?.message || '网络错误，请重试'); setPhase('error');
    }
  }, [targetLang]);

  return (
    <div className="file-translator">
      {/* 入口行 */}
      {phase === 'idle' && (
        <div className="file-entry">
          <div className="file-entry-types">
            <span className="file-entry-label">📎 文件翻译：</span>
            {(Object.keys(ACCEPT) as FileType[]).map(t => (
              <button key={t} type="button" className="file-type-btn" onClick={() => inputRef.current?.click()}
                data-type={t} title={`上传 ${TYPE_LABEL[t]}（${ACCEPT[t]}）`}>
                {t === 'pdf' ? '📄 PDF' : t === 'image' ? '🖼 图片' : t === 'subtitle' ? '🎬 字幕' : '📝 Word/PPT'}
              </button>
            ))}
            <input ref={inputRef} type="file" hidden accept={Object.values(ACCEPT).join(',')} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </div>
          <div
            className={`file-dropzone${dragOver ? ' drag' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          >
            或拖拽文件到这里（PDF / 图片 / SRT·VTT 字幕 / Word·PPT）
          </div>
        </div>
      )}

      {/* 处理中 */}
      {phase === 'working' && (
        <div className="file-working">
          <div className="file-working-title">正在翻译《{fileName}》…（{TYPE_LABEL[fileType]}）</div>
          <div className="file-progress"><div className="file-progress-bar" style={{ width: `${progress || 5}%` }} /></div>
          <div className="file-working-hint">{progress}% · 大文件可能需要 30-60 秒</div>
        </div>
      )}

      {/* 错误 */}
      {phase === 'error' && (
        <div className="file-error">
          <span>⚠️ {error}</span>
          <button type="button" className="btn-google-sm" onClick={reset}>重新选择</button>
        </div>
      )}

      {/* 结果 */}
      {phase === 'done' && (
        <div className="file-done">
          <div className="file-done-head">
            <span className="file-done-name">📄 {fileName} · 翻译完成</span>
            <button type="button" className="file-done-close" onClick={reset} title="关闭">×</button>
          </div>
          {fileType === 'image' && imageResult && (
            <div className="file-image-result">
              <div className="file-image-preview"><img src={imageResult.preview} alt="上传的图片" /></div>
              <div className="file-image-cols">
                <div className="file-image-col"><div className="file-image-col-title">识别文字</div><div className="file-image-col-body">{imageResult.text}</div></div>
                <div className="file-image-col"><div className="file-image-col-title">译文</div><div className="file-image-col-body">{imageResult.translation}</div></div>
              </div>
              <div className="file-image-actions">
                <button type="button" className="btn-google-sm" onClick={() => { navigator.clipboard.writeText(`${imageResult.text}\n\n${imageResult.translation}`).then(() => showToast('已复制')).catch(() => showToast('复制失败')); }}>📋 复制</button>
                <a className="btn-google-sm" href={TOOL_URL.image} style={{ textDecoration: 'none' }}>完整工具 →</a>
              </div>
            </div>
          )}
          {fileType === 'doc' && renderPairs(pairs, 50, true)}
          {fileType === 'subtitle' && (
            <div className="file-result">
              <div className="file-result-head">
                <span>字幕翻译完成 ✓ · {subtitleCues.length} 条</span>
                <div className="file-result-actions">
                  <a className="btn-google-sm" href={TOOL_URL.subtitle} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>导出 SRT →</a>
                </div>
              </div>
              <div className="file-pairs">
                {subtitleCues.slice(0, 15).map(c => (
                  <div className="file-pair" key={c.index}>
                    <div className="file-pair-src"><span className="file-pair-time">{c.start}</span> {c.text}</div>
                    <div className="file-pair-dst">{c.translation || c.text}</div>
                  </div>
                ))}
              </div>
              {subtitleCues.length > 15 && <div className="file-more">仅显示前 15 条，共 {subtitleCues.length} 条 · <a href={TOOL_URL.subtitle} style={{ color: 'var(--accent)' }}>打开完整工具导出</a></div>}
            </div>
          )}
          {fileType === 'pdf' && renderPairs(pairs, 10, true)}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
