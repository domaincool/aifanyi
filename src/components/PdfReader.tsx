'use client';
/**
 * PDF 双语阅读器（阶段 3+4）
 * 双栏阅读 + 视图切换 + 字号 + 段落复制 + 多模型对比浮层（DeepSeek/GLM/Google）+ 采用
 */
import { useState } from 'react';

export interface PdfReaderResult {
  fileName: string;
  pageCount: number;
  sourceLang: string;
  targetLang: string;
  limitations?: string[];
  pages: {
    pageNumber: number;
    blocks: {
      id: string;
      type: string;
      text: string;
      translations?: Record<string, { text: string; model: string } | undefined>;
    }[];
  }[];
  stats?: {
    totalBlocks: number;
    translatedBlocks: number;
    failedBlocks: number;
    totalCostUsd: number;
    durationMs: number;
  };
}

const LANG_LABEL: Record<string, string> = { zh: '中文', en: '英语', ja: '日语', ko: '韩语', ru: '俄语', fr: '法语', de: '德语', es: '西班牙语', auto: '自动' };
const MODEL_LABEL: Record<string, string> = { deepseek: 'DeepSeek', glm: 'GLM', google: 'Google 翻译' };

export default function PdfReader({ result }: { result: PdfReaderResult }) {
  const [view, setView] = useState<'dual' | 'source' | 'target'>('dual');
  const [fontSize, setFontSize] = useState(15);
  const [activePage, setActivePage] = useState<number | null>(null);
  // 采用覆盖：blockId → { text, model }
  const [overrides, setOverrides] = useState<Record<string, { text: string; model: string }>>({});
  // 对比浮层
  const [compare, setCompare] = useState<{ pageNumber: number; blockId: string; sourceText: string } | null>(null);
  const [compareData, setCompareData] = useState<Record<string, { text: string; model: string }> | null>(null);
  const [comparing, setComparing] = useState(false);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const openCompare = async (taskId: string | undefined, pageNumber: number, blockId: string, sourceText: string) => {
    if (!taskId) return;
    setCompare({ pageNumber, blockId, sourceText });
    setCompareData(null);
    setComparing(true);
    try {
      const res = await fetch('/api/pdf/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, blockId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || '对比失败，请稍后重试。');
        setCompare(null);
        return;
      }
      setCompareData(data.translations || {});
    } catch {
      alert('网络异常，对比失败，请稍后重试。');
      setCompare(null);
    } finally {
      setComparing(false);
    }
  };

  const adopt = (blockId: string, text: string, model: string) => {
    setOverrides((prev) => ({ ...prev, [blockId]: { text, model } }));
    setCompare(null);
  };

  // 任务 id：从 result 里没有，需要页面传入。用 props 扩展
  // （页面层传 taskId，见页面改动）

  const headings = result.pages.flatMap((p) =>
    p.blocks.filter((b) => b.type === 'heading' && b.text).map((b) => ({ page: p.pageNumber, text: b.text }))
  );

  const renderSourceBlock = (b: { id: string; type: string; text: string }) => {
    const isSkipped = b.type === 'header' || b.type === 'footer' || b.type === 'image';
    return (
      <div className={`reader-block reader-${b.type}`} key={b.id}>
        {b.type === 'image' && <span className="reader-image-ph">[图片，暂不支持翻译]</span>}
        {b.text}
        {!isSkipped && (
          <span className="reader-actions">
            <button onClick={() => copy(b.text)} title="复制原文">📋</button>
          </span>
        )}
      </div>
    );
  };

  const renderTargetBlock = (b: { id: string; type: string; text: string; translations?: Record<string, { text: string; model: string } | undefined> }) => {
    const isSkipped = b.type === 'header' || b.type === 'footer' || b.type === 'image';
    const override = overrides[b.id];
    const dst = override?.text ?? b.translations?.deepseek?.text;
    const dstModel = override?.model ?? 'deepseek';
    return (
      <div className={`reader-block reader-${b.type}`} key={b.id}>
        {isSkipped ? (
          <span className="reader-skipped">{b.type === 'image' ? '[图片]' : b.text}</span>
        ) : dst ? (
          <>
            <span className="reader-model-tag">{MODEL_LABEL[dstModel] || dstModel}</span>
            {dst}
            <span className="reader-actions">
              <button onClick={() => copy(dst)} title="复制译文">📋</button>
              <button onClick={() => openCompare(taskId, 0, b.id, b.text)} title="查看其他模型">🔀</button>
            </span>
          </>
        ) : (
          <span className="reader-missing">[翻译失败]</span>
        )}
      </div>
    );
  };

  // taskId 由页面传入（props.taskId）
  const taskId = (result as any).taskId as string | undefined;

  return (
    <div className="reader">
      {/* 顶部工具条 */}
      <div className="reader-top">
        <div className="reader-top-info">
          <span className="reader-fname">📄 {result.fileName}</span>
          <span className="reader-meta">{LANG_LABEL[result.sourceLang] || result.sourceLang} → {LANG_LABEL[result.targetLang] || result.targetLang} · {result.pageCount} 页</span>
        </div>
        <div className="reader-top-controls">
          <div className="reader-viewswitch" role="tablist" aria-label="视图切换">
            {([['dual', '双栏'], ['source', '仅原文'], ['target', '仅译文']] as const).map(([v, label]) => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{label}</button>
            ))}
          </div>
          <div className="reader-fontsize">
            <button onClick={() => setFontSize((s) => Math.max(12, s - 1))} aria-label="减小字号">A-</button>
            <button onClick={() => setFontSize((s) => Math.min(22, s + 1))} aria-label="增大字号">A+</button>
          </div>
        </div>
      </div>

      {result.limitations && result.limitations.length > 0 && (
        <div className="reader-limitations">{result.limitations.map((l, i) => <span key={i}>ℹ️ {l}</span>)}</div>
      )}

      <div className="reader-body">
        <aside className="reader-nav">
          <p className="reader-nav-title">目录</p>
          {headings.length > 0 ? (
            <ul>
              {headings.map((h, i) => (
                <li key={i}><button onClick={() => { setActivePage(h.page); document.getElementById(`page-${h.page}`)?.scrollIntoView({ behavior: 'smooth' }); }}>{h.text.slice(0, 30)}</button></li>
              ))}
            </ul>
          ) : <p className="reader-nav-empty">无标题</p>}
          <p className="reader-nav-title">页面</p>
          <ul className="reader-pages">
            {result.pages.map((p) => (
              <li key={p.pageNumber}><button className={activePage === p.pageNumber ? 'active' : ''} onClick={() => { setActivePage(p.pageNumber); document.getElementById(`page-${p.pageNumber}`)?.scrollIntoView({ behavior: 'smooth' }); }}>第 {p.pageNumber} 页</button></li>
            ))}
          </ul>
        </aside>

        <main className="reader-main" style={{ fontSize }}>
          {result.pages.map((p) => (
            <section className={`reader-page ${view}`} id={`page-${p.pageNumber}`} key={p.pageNumber}>
              <h3 className="reader-page-title">第 {p.pageNumber} 页</h3>
              <div className="reader-cols">
                {view !== 'target' && (
                  <div className="reader-col reader-col-source">
                    <p className="reader-col-label">原文</p>
                    {p.blocks.map(renderSourceBlock)}
                  </div>
                )}
                {view !== 'source' && (
                  <div className="reader-col reader-col-target">
                    <p className="reader-col-label">AI 推荐译文</p>
                    {p.blocks.map(renderTargetBlock)}
                  </div>
                )}
              </div>
            </section>
          ))}
        </main>
      </div>

      {/* 对比浮层 */}
      {compare && (
        <div className="reader-modal-mask" onClick={() => setCompare(null)}>
          <div className="reader-modal" onClick={(e) => e.stopPropagation()}>
            <button className="reader-modal-close" onClick={() => setCompare(null)}>✕</button>
            <h4>多模型对比</h4>
            <p className="reader-modal-src">{compare.sourceText}</p>
            {comparing ? (
              <p className="reader-modal-loading">对比中…（DeepSeek 译文已展示，正在获取 GLM / Google）</p>
            ) : compareData ? (
              <div className="reader-modal-cols">
                {(['deepseek', 'glm', 'google'] as const).map((m) => {
                  const t = compareData[m];
                  return (
                    <div className={`reader-modal-col ${!t ? 'empty' : ''}`} key={m}>
                      <p className="reader-modal-model">{MODEL_LABEL[m]}</p>
                      <p className="reader-modal-text">{t?.text || '获取失败'}</p>
                      {t?.text && (
                        <button className="reader-adopt" onClick={() => adopt(compare.blockId, t.text, m)}>采用</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
