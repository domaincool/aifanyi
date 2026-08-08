'use client';

import { useState } from 'react';

export default function TranslatorBox() {
  const [text, setText] = useState('');
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');
  const [scenario, setScenario] = useState('general');
  const [result, setResult] = useState('');
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);

  async function doTranslate() {
    if (!text.trim()) return;
    setLoading(true);
    setResult('');
    setMeta('');
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang, scenario }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`出错了：${data.error}`);
      } else {
        setResult(data.text);
        setMeta(`模型：${data.model}${data.cached ? '（缓存命中）' : ''} · 耗时 ${data.latencyMs}ms`);
      }
    } catch (e: any) {
      setResult(`网络错误：${e.message}`);
    } finally {
      setLoading(false);
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
        </select>
        <span>→</span>
        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          <option value="en">英语</option>
          <option value="zh">中文</option>
          <option value="ja">日语</option>
          <option value="de">德语</option>
          <option value="es">西班牙语</option>
        </select>
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          <option value="general">通用翻译</option>
          <option value="ecommerce">电商 Listing</option>
          <option value="meme">网络梗翻译</option>
        </select>
        <button className="primary" onClick={doTranslate} disabled={loading}>
          {loading ? '翻译中…' : '翻译'}
        </button>
      </div>
      {result && (
        <div className="result">
          {result}
          {meta && <div className="meta">{meta}</div>}
        </div>
      )}
    </div>
  );
}
