'use client';
/**
 * 爱翻译 AI PDF 翻译阅读器（P1 阶段 1：上传 → 校验 → 解析 → Job 创建）
 * 阶段 2 起接入：轮询进度 / 翻译 / 双语阅读 / 多模型对比 / 下载
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import PdfReader from '@/components/PdfReader';

interface UploadResult {
  taskId: string;
  status: string;
  pageCount: number;
  totalBlocks: number;
  totalCharacters: number;
  sourceLang: string;
  targetLang: string;
  limitations?: string[];
}

export default function PdfTranslatorPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<{ errorType: string; message: string } | null>(null);
  const [job, setJob] = useState<{ status: string; progress: number; currentPage: number; totalPages: number; translatedBlocks: number; totalBlocks: number; errorType?: string; message?: string; result?: any } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    setJob(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/pdf/translate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError({ errorType: data.errorType || 'parse_failed', message: data.message || '上传失败，请稍后重试。' });
        return;
      }
      setResult(data as UploadResult);
      pollTask(data.taskId);
    } catch {
      setError({ errorType: 'parse_failed', message: '网络异常，上传失败，请稍后重试。' });
    } finally {
      setUploading(false);
    }
  }, []);

    const pollTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/pdf/tasks/${taskId}`);
      const data = await res.json();
      setJob(data);
      if (data.status === 'processing' || data.status === 'queued') {
        setTimeout(() => pollTask(taskId), 1500);
      }
    } catch {
      // 轮询失败静默重试一次
      setTimeout(() => pollTask(taskId), 3000);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const langLabel: Record<string, string> = { zh: '中文', en: '英语', ja: '日语', ko: '韩语', ru: '俄语', auto: '自动识别' };

  return (
    <div className="pdf-page">
      <section className="pdf-hero">
        <h1>📄 PDF 翻译</h1>
        <p>上传 PDF，AI 自动翻译成中文，原文译文对照阅读，段落不满意还能对比 DeepSeek / GLM / Google 三个模型。</p>
      </section>

      {/* 上传区 */}
      <div
        className={`pdf-dropzone ${dragging ? 'pdf-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="上传 PDF 文件"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <div className="pdf-drop-icon">📄</div>
        <p className="pdf-drop-title">{uploading ? '上传解析中…' : dragging ? '松开上传' : '点击或拖拽 PDF 到此处'}</p>
        <p className="pdf-drop-sub">单文件 ≤ 20MB · ≤ 100 页 · 文本 ≤ 100 万字符</p>
      </div>

      {/* 隐私提示 */}
      <div className="pdf-privacy">
        <p>🔒 <strong>隐私说明</strong>：文件将在翻译完成后自动处理，并在 <strong>24 小时内删除</strong>。PDF 内容会发送给第三方 AI 模型 API（DeepSeek / GLM / Google）用于翻译，请勿上传包含敏感信息的文件。</p>
      </div>

      {/* 错误提示（12 类错误全覆盖） */}
      {error && (
        <div className="pdf-error" role="alert">
          <p className="pdf-error-title">⚠️ 无法处理该文件</p>
          <p>{error.message}</p>
          {error.errorType === 'no_text_layer' && (
            <p className="pdf-error-why">
              为什么不能翻译？<br />
              扫描版 PDF 本质上是图片，没有可提取的文字层，需要 OCR 识别后才能翻译。
              <span className="pdf-ocr-coming">OCR PDF 翻译即将推出</span>
            </p>
          )}
          <button className="pdf-btn" onClick={() => { setError(null); inputRef.current?.click(); }}>重新选择文件</button>
        </div>
      )}

      {/* 解析结果摘要（阶段 2 接翻译进度） */}
      {result && (
        <div className="pdf-summary">
          <h2>✅ 解析完成</h2>
          <div className="pdf-summary-grid">
            <div><span>任务号</span><b>{result.taskId}</b></div>
            <div><span>页数</span><b>{result.pageCount} 页</b></div>
            <div><span>内容块</span><b>{result.totalBlocks} 块</b></div>
            <div><span>文本量</span><b>{(result.totalCharacters / 1000).toFixed(1)}K 字符</b></div>
            <div><span>源语言</span><b>{langLabel[result.sourceLang] || result.sourceLang}</b></div>
            <div><span>目标语言</span><b>{langLabel[result.targetLang] || result.targetLang}</b></div>
          </div>
          {result.limitations && result.limitations.length > 0 && (
            <div className="pdf-limitations">
              {result.limitations.map((l, i) => <p key={i}>ℹ️ {l}</p>)}
            </div>
          )}
          {job && (job.status === 'queued' || job.status === 'processing') && (
            <div className="pdf-progress">
              <div className="pdf-progress-bar"><div className="pdf-progress-fill" style={{ width: `${job.progress}%` }} /></div>
              <p>翻译中… {job.progress}%（第 {job.currentPage || 1}/{job.totalPages} 页 · {job.translatedBlocks}/{job.totalBlocks} 块）</p>
            </div>
          )}
          {job && job.status === 'completed' && (
            <div className="pdf-done">
              <p>✅ 翻译完成！{job.result?.stats?.translatedBlocks ?? job.translatedBlocks}/{job.totalBlocks} 块</p>
              {job.result?.stats && (
                <p className="pdf-done-stats">
                  成本 ¥{((job.result.stats.totalCostUsd || 0) * 7.2).toFixed(3)} · 耗时 {Math.round((job.result.stats.durationMs || 0) / 1000)}s
                  {job.result.stats.failedBlocks > 0 && ` · ${job.result.stats.failedBlocks} 块失败`}
                </p>
              )}
              {job.result && <PdfReader result={job.result} />}
            </div>
          )}
          {job && job.status === 'failed' && (
            <div className="pdf-error">
              <p className="pdf-error-title">⚠️ 翻译失败</p>
              <p>{job.message || '翻译过程中出现错误，请稍后重试。'}</p>
              <button className="pdf-btn" onClick={() => inputRef.current?.click()}>重新选择文件</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
