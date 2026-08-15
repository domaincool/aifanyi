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
  const [job, setJob] = useState<{ taskId: string; status: string; progress: number; currentPage: number; totalPages: number; translatedBlocks: number; totalBlocks: number; errorType?: string; message?: string; result?: any } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    setJob(null);
    track('pdf_upload', { fileName: file.name });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/pdf/translate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError({ errorType: data.errorType || 'parse_failed', message: data.message || '上传失败，请稍后重试。' });
        track('pdf_parse_failed', { errorType: data.errorType });
        return;
      }
      setResult(data as UploadResult);
      track('pdf_parse_success', { taskId: data.taskId, pageCount: data.pageCount, sourceLang: data.sourceLang, targetLang: data.targetLang });
      track('translation_started', { taskId: data.taskId });
      pollTask(data.taskId);
    } catch {
      setError({ errorType: 'parse_failed', message: '网络异常，上传失败，请稍后重试。' });
    } finally {
      setUploading(false);
    }
  }, []);

    const track = (event: string, data: Record<string, unknown> = {}) => {
    fetch('/api/pdf/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, ...data }) }).catch(() => {});
  };

  const pollTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/pdf/tasks/${taskId}`);
      const data = await res.json();
      setJob(data);
      if (data.status === 'processing' || data.status === 'queued') {
        setTimeout(() => pollTask(taskId), 1500);
      } else if (data.status === 'completed') {
        track('translation_completed', { taskId, durationMs: data.result?.stats?.durationMs, costUsd: data.result?.stats?.totalCostUsd });
      } else if (data.status === 'failed') {
        track('translation_failed', { taskId });
      }
    } catch {
      // 轮询失败静默重试一次
      setTimeout(() => pollTask(taskId), 3000);
    }
  }, []);

  const cancelTask = useCallback(async () => {
    if (!job?.taskId) return;
    try {
      const res = await fetch(`/api/pdf/tasks/${job.taskId}`, { method: 'PATCH' });
      const data = await res.json();
      if (data.ok) {
        setJob((prev: any) => (prev ? { ...prev, status: 'cancelled', message: '任务已取消，额度已退回。' } : prev));
      } else {
        setError({ errorType: 'cancel_failed', message: data.error || '取消失败，请稍后再试。' });
      }
    } catch {
      setError({ errorType: 'cancel_failed', message: '网络错误，取消失败。' });
    }
  }, [job?.taskId]);

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
        <h1>免费 PDF 在线翻译</h1>
        <p>上传 PDF 自动翻译成中文 / 英文，DeepSeek / GLM / Google 三模型对比翻译，双语对照阅读，保留标题列表结构，支持下载 DOCX / TXT。</p>
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


      {/* ===== PDF SEO ===== */}
      <section className="pdf-seo">
        <h2>怎么用</h2>
        <div className="pdf-seo-steps">
          <div className="pdf-seo-step"><span className="pdf-seo-step-num">1</span><strong>上传 PDF 文件</strong><p>支持拖拽或点击选择，{String.fromCharCode(8804)}20MB / {String.fromCharCode(8804)}100页</p></div>
          <div className="pdf-seo-step"><span className="pdf-seo-step-num">2</span><strong>自动识别源语言并翻译</strong><p>选择目标语言后开始翻译，支持 10 种语言互译</p></div>
          <div className="pdf-seo-step"><span className="pdf-seo-step-num">3</span><strong>双语对照阅读与下载</strong><p>段落不满意可对比三个 AI 模型译文，下载 DOCX 或 TXT</p></div>
        </div>

        <h2>核心功能</h2>
        <div className="pdf-seo-features">
          <div className="pdf-seo-feature"><h3>三模型对比</h3><p>同一段落可切换查看 DeepSeek / GLM / Google 三个 AI 的译文，选中最佳直接替换——不信任任何单一 AI 的翻译结果。基于 50 段盲测：DeepSeek A 级 98%，Google A 级 84%，GLM A 级 62%。</p></div>
          <div className="pdf-seo-feature"><h3>双语对照阅读</h3><p>桌面端左原文右译文，手机端上下排列；标题对标题、列表对列表、段落对段落，不丢失文档结构。</p></div>
          <div className="pdf-seo-feature"><h3>智能结构识别</h3><p>自动识别 PDF 中的标题、正文、列表和段落，保留阅读层次；页眉页脚自动跳过。</p></div>
          <div className="pdf-seo-feature"><h3>多种下载格式</h3><p>译文 DOCX（编辑用）、双语对照 DOCX（存档审校）、纯文本 TXT。</p></div>
          <div className="pdf-seo-feature"><h3>隐私保护</h3><p>文件 24 小时后自动删除，翻译过程明示调用第三方 AI API（DeepSeek / GLM / Google）。</p></div>
        </div>

        <h2>适用场景</h2>
        <div className="pdf-seo-scenarios">
          <div className="pdf-seo-scenario"><h3>{String.fromCodePoint(0x1F4C4)} 英文合同 / 协议</h3><p>三模型对比避免关键条款误译，尤其术语和数字。</p></div>
          <div className="pdf-seo-scenario"><h3>{String.fromCodePoint(0x1F4DA)} 外文文献 / 论文</h3><p>保留标题列表结构，双语对照精读，下载 DOCX 编辑引用。</p></div>
          <div className="pdf-seo-scenario"><h3>{String.fromCodePoint(0x1F4D6)} 英文说明书 / 技术文档</h3><p>快速理解技术细节，段落级对比确保术语一致性。</p></div>
          <div className="pdf-seo-scenario"><h3>{String.fromCodePoint(0x1F6D2)} 海外购物单据 / 账单</h3><p>翻译发票、订单确认、保修卡等轻量文档。</p></div>
          <div className="pdf-seo-scenario"><h3>{String.fromCodePoint(0x1F4BC)} 跨境电商 Listing / 产品资料</h3><p>竞品详情页翻译、平台政策文档理解。</p></div>
        </div>

        <h2>常见问题</h2>
        <div className="pdf-seo-faq">
          <div className="pdf-seo-faq-item"><h3>免费吗？有次数限制吗？</h3><p>登录后使用额度制计费：新用户注册即送 500 免费额度（30 天有效）。仅翻译成功的部分扣费，失败自动退回，额度消耗透明可查。</p></div>
          <div className="pdf-seo-faq-item"><h3>翻译需要多久？</h3><p>小文件通常几秒到十几秒即可完成；大文件（几十页 / 长文档）按批翻译，可能需要几分钟。页面会实时显示解析与翻译进度，完成即可对照阅读，无需一直等待。</p></div>
          <div className="pdf-seo-faq-item"><h3>支持多大文件？</h3><p>单个文件 {String.fromCharCode(8804)} 20MB，{String.fromCharCode(8804)} 100 页，文本量 {String.fromCharCode(8804)} 100 万字符。超过任一限制会在上传时直接提示，不会浪费等待时间。</p></div>
          <div className="pdf-seo-faq-item"><h3>扫描版 PDF 支持吗？</h3><p>当前版本仅支持文本型 PDF（Word / Google Docs 等导出的单栏文档效果最佳）。如果上传扫描版（纯图片）PDF，页面会明确提示{String.fromCharCode(8220)}暂不支持{String.fromCharCode(8221)}，并引导到即将推出的 OCR 功能。</p></div>
          <div className="pdf-seo-faq-item"><h3>能保留原 PDF 的排版吗？</h3><p>当前版本为双语阅读器模式（左右对照阅读），不输出原版式 PDF。原版式 PDF 重建功能在后续版本规划中。</p></div>
          <div className="pdf-seo-faq-item"><h3>翻译质量怎么样？</h3><p>默认使用 DeepSeek 主模型翻译（50 段盲测 A 级 98%）。对任意段落不满意，可点击{String.fromCharCode(8220)}查看其他模型{String.fromCharCode(8221)}切换到 GLM / Google 的译文，选择你最满意的一版。</p></div>
          <div className="pdf-seo-faq-item"><h3>文件安全吗？会保存我的 PDF 吗？</h3><p>原始 PDF 翻译完成后即删除，翻译结果 24 小时后自动清理。翻译过程会调用第三方 AI 模型 API（DeepSeek / GLM / Google），上传前页面已明示。</p></div>
          <div className="pdf-seo-faq-item"><h3>支持哪些语言？</h3><p>支持 10 种语言互译：中文、英文、日文、韩文、法文、德文、俄文、西班牙文、葡萄牙文、阿拉伯文。</p></div>
        </div>

        <h2>限制说明</h2>
        <ul className="pdf-seo-limits">
          <li>扫描版 PDF（纯图片无文本层）暂不支持，OCR 功能后续推出</li>
          <li>多栏 / 报纸排版 PDF 可能出现阅读顺序错乱，页面会标注提示</li>
          <li>复杂表格可能退化为逐行文本，表格结构化功能在后续版本规划中</li>
          <li>文件大小 {String.fromCharCode(8804)} 20MB、页数 {String.fromCharCode(8804)} 100 页、文本 {String.fromCharCode(8804)} 100 万字符，超限直接拒绝</li>
        </ul>
      </section>

      

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
          <button className="pdf-btn" onClick={() => { track('retry_clicked'); setError(null); inputRef.current?.click(); }}>重新选择文件</button>
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
              <button className="pdf-btn" style={{ marginBottom: 8 }} onClick={cancelTask}>✕ 取消任务（退回额度）</button>
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
              {job.result && <PdfReader result={{ ...job.result, taskId: job.taskId } as any} />}
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
