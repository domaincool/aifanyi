'use client';
/**
 * PDF 双语阅读器（阶段 3）
 * 左：页面/目录导航；中：原文；右：AI 推荐译文
 * 视图：双栏 / 仅原文 / 仅译文；字号调节；段落 hover 复制
 * 阶段 4 接：查看其他模型（对比浮层）
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

export default function PdfReader({ result }: { result: PdfReaderResult }) {
  const [view, setView] = useState<'dual' | 'source' | 'target'>('dual');
  const [fontSize, setFontSize] = useState(15);
  const [activePage, setActivePage] = useState<number | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const headings = result.pages.flatMap((p) =>
    p.blocks.filter((b) => b.type === 'heading' && b.text).map((b) => ({ page: p.pageNumber, text: b.text }))
  );

  const renderBlock = (b: { id: string; type: string; text: string; translations?: Record<string, { text: string; model: string } | undefined> }, showSource: boolean) => {
    const dst = b.translations?.deepseek?.text;
    const isSkipped = b.type === 'header' || b.type === 'footer' || b.type === 'image';
    const cls = `reader-block reader-${b.type}`;
    if (showSource) {
      return (
        <div className={cls} key={b.id}>
          {b.type === 'image' && <span className="reader-image-ph">[图片，暂不支持翻译]</span>}
          {b.text}
          {!isSkipped && (
            <span className="reader-actions">
              <button onClick={() => copy(b.text)} title="复制原文">📋</button>
            </span>
          )}
        </div>
      );
    }
    // 译文侧
    return (
      <div className={cls} key={b.id}>
        {isSkipped ? (
          <span className="reader-skipped">{b.type === 'image' ? '[图片]' : b.text}</span>
        ) : dst ? (
          <>
            {dst}
            <span className="reader-actions">
              <button onClick={() => copy(dst)} title="复制译文">📋</button>
              <button title="查看其他模型（即将上线）" onClick={() => alert('多模型对比即将上线，敬请期待！')}>🔀</button>
            </span>
          </>
        ) : (
          <span className="reader-missing">[翻译失败]</span>
        )}
      </div>
    );
  };

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
        {/* 左：目录/页面导航 */}
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

        {/* 中/右：内容 */}
        <main className="reader-main" style={{ fontSize }}>
          {result.pages.map((p) => (
            <section className={`reader-page ${view}`} id={`page-${p.pageNumber}`} key={p.pageNumber}>
              <h3 className="reader-page-title">第 {p.pageNumber} 页</h3>
              <div className="reader-cols">
                {view !== 'target' && (
                  <div className="reader-col reader-col-source">
                    <p className="reader-col-label">原文</p>
                    {p.blocks.map((b) => renderBlock(b, true))}
                  </div>
                )}
                {view !== 'source' && (
                  <div className="reader-col reader-col-target">
                    <p className="reader-col-label">AI 推荐译文</p>
                    {p.blocks.map((b) => renderBlock(b, false))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
