'use client';

import { useState } from 'react';

const LANG_LABEL: Record<string, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  de: 'Deutsch',
  es: 'Español',
};
const TTS_LANG: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
  de: 'de-DE',
  es: 'es-ES',
};

export default function TranslatorBox() {
  const [text, setText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');
  const [scenario, setScenario] = useState('auto');
  const [result, setResult] = useState('');
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [status, setStatus] = useState(''); // 卡片头部状态：已完成 / 已润色 / 已复制
  const [toast, setToast] = useState(''); // 轻提示

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }

  async function doTranslate() {
    if (!text.trim()) return;
    setLoading(true);
    setResult('');
    setMeta('');
    setStatus('');
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang, scenario }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`出错了：${data.error}`);
        setStatus('失败');
      } else {
        setResult(data.text);
        setMeta(`模型：${data.model}${data.cached ? '（缓存命中）' : ''} · 耗时 ${data.latencyMs}ms`);
        setStatus('已完成');
      }
    } catch (e: any) {
      setResult(`网络错误：${e.message}`);
      setStatus('失败');
    } finally {
      setLoading(false);
    }
  }

  async function doPolish() {
    if (!result || result.startsWith('出错了') || result.startsWith('网络错误')) return;
    setPolishing(true);
    setStatus('润色中…');
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result, sourceLang: targetLang, targetLang, scenario, polish: true }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus('润色失败');
        showToast('润色失败');
      } else {
        setResult(data.text);
        setMeta(`已润色 · 模型：${data.model}${data.cached ? '（缓存命中）' : ''}`);
        setStatus('已润色 ✨');
      }
    } catch (e: any) {
      setStatus('润色失败');
      showToast('润色失败');
    } finally {
      setPolishing(false);
    }
  }

  function doSpeak() {
    if (!result) return;
    if (!('speechSynthesis' in window)) {
      showToast('当前浏览器不支持发音');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(result);
    u.lang = TTS_LANG[targetLang] || 'en-US';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  async function doCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setStatus('已复制 ✓');
      showToast('已复制到剪贴板');
    } catch {
      showToast('复制失败，请手动选择复制');
    }
  }

  async function doShare() {
    if (!result) return;
    const shareText = `我在爱翻译把「${text.slice(0, 40)}${text.length > 40 ? '…' : ''}」翻译成：${result} —— 试试 AI 翻译擂台 → https://aifanyi.com`;
    if (navigator.share) {
      try {
        await navigator.share({ title: '爱翻译 · AI翻译', text: shareText });
      } catch { /* 用户取消分享 */ }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setStatus('分享文案已复制 ✓');
        showToast('已复制分享文案');
      } catch {
        showToast('分享失败');
      }
    }
  }

  return (
    <div className="translator-box">
      <textarea
        placeholder="输入要翻译的内容…（示例：这款无线耳机降噪效果一流，续航 30 小时）"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row">
        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
          <option value="zh">中文</option>
          <option value="en">英语</option>
          <option value="ja">日语</option>
          <option value="de">德语</option>
          <option value="es">西班牙语</option>
        </select>
        <button
          type="button"
          className="swap-btn"
          title="交换语言"
          aria-label="交换源语言和目标语言"
          onClick={() => {
            setSourceLang(targetLang);
            setTargetLang(sourceLang);
            if (result) {
              setText(result);
              setResult('');
              setMeta('');
              setStatus('');
            }
          }}
        >
          ⇄
        </button>
        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          <option value="en">英语</option>
          <option value="zh">中文</option>
          <option value="ja">日语</option>
          <option value="de">德语</option>
          <option value="es">西班牙语</option>
        </select>
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          <option value="auto">AI 自动判断</option>
          <option value="business">商务翻译</option>
          <option value="academic">学术翻译</option>
          <option value="casual">口语翻译</option>
          <option value="gaming">游戏翻译</option>
        </select>
        <button className="primary" onClick={doTranslate} disabled={loading || polishing}>
          {loading ? '翻译中…' : '翻译'}
        </button>
      </div>
      {result && (
        <div className="result-card">
          <div className="result-head">
            <span className="result-lang">{LANG_LABEL[targetLang] || targetLang} <span className="result-ok">✓</span></span>
            <span className="result-status">{status || '已完成'}</span>
          </div>
          <div className="result-body">{result}</div>
          <div className="result-actions">
            <button type="button" onClick={doPolish} disabled={polishing || loading}>
              ✨ AI润色{polishing ? '中…' : ''}
            </button>
            <button type="button" onClick={doSpeak} disabled={!result}>🔊 发音</button>
            <button type="button" onClick={doCopy} disabled={!result}>📋 复制</button>
            <button type="button" onClick={doShare} disabled={!result}>↗ 分享</button>
          </div>
          {meta && <div className="result-meta">{meta}</div>}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}