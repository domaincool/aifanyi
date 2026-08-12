'use client';

import { useEffect, useRef, useState } from 'react';
import FileTranslator from './FileTranslator';

const LANG_LABEL: Record<string, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  ru: 'Русский',
  ar: 'العربية',
  pt: 'Português',
  ko: '한국어',
};
const TTS_LANG: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  ru: 'ru-RU',
  ar: 'ar-SA',
  pt: 'pt-PT',
  ko: 'ko-KR',
};

export default function TranslatorBox({
  defaultSourceLang = 'zh',
  defaultTargetLang = 'en',
}: {
  defaultSourceLang?: string;
  defaultTargetLang?: string;
}) {
  const [text, setText] = useState('');
  const [sourceLang, setSourceLang] = useState(defaultSourceLang);
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [scenario, setScenario] = useState('auto');
  const [result, setResult] = useState('');
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [status, setStatus] = useState(''); // 卡片头部状态：已完成 / 已润色 / 已复制
  const [toast, setToast] = useState(''); // 轻提示
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explain, setExplain] = useState<{ tone: string; scene: string; localization: string; why: string } | null>(null);
  const [promptLogin, setPromptLogin] = useState(false); // 翻译完成挽留条（未登录时）
  const [loggedIn, setLoggedIn] = useState(false); // 登录态（决定是否显示预计额度）
  const [est, setEst] = useState<number | null>(null); // 预计消耗额度
  const estTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 挂载时探测登录态
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((d: any) => { if (d && d.user) setLoggedIn(true); }).catch(() => {});
    return () => { if (estTimer.current) clearTimeout(estTimer.current); };
  }, []);

  // 输入变化 → 服务端估算（前端永不算价；debounce 400ms）
  useEffect(() => {
    if (estTimer.current) clearTimeout(estTimer.current);
    const t = text.trim();
    if (!loggedIn || !t) { setEst(null); return; }
    estTimer.current = setTimeout(async () => {
      try {
        const feature = scenario === 'polish' ? 'polish' : 'text';
        const res = await fetch('/api/credit/estimate?feature=' + feature + '&chars=' + t.length);
        const d = await res.json();
        setEst(typeof d.credits === 'number' && d.credits > 0 ? d.credits : null);
      } catch { setEst(null); }
    }, 400);
    return () => { if (estTimer.current) clearTimeout(estTimer.current); };
  }, [text, scenario, loggedIn]);

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
        body: JSON.stringify({
          text,
          sourceLang,
          targetLang: scenario === 'polish' ? sourceLang : targetLang,
          scenario,
          polish: scenario === 'polish' ? true : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`出错了：${data.error}`);
        setStatus('失败');
      } else {
        setResult(data.text);
        setMeta(`模型：${data.model}${data.cached ? '（缓存命中）' : ''} · 耗时 ${data.latencyMs}ms`);
        setStatus(scenario === 'polish' ? '已润色 ✨' : '已完成');
        setExplain(null);
        setExplainOpen(false);
        // 未登录时显示保存挽留条（每会话一次，可关闭）
        try {
          fetch('/api/auth/me').then(r => r.json()).then(d => {
            if (!d.user && !sessionStorage.getItem('aifanyi_login_prompt_dismissed')) setPromptLogin(true);
          }).catch(() => {});
        } catch {}
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
        setExplain(null);
        setExplainOpen(false);
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

  async function loadExplain() {
    if (explain || explainLoading) return;
    setExplainLoading(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText: text, targetText: result, sourceLang, targetLang, scenario }),
      });
      const data = await res.json();
      if (data.error) {
        setExplain({ tone: '', scene: '', localization: '', why: '暂时无法生成讲解，稍后再试。' });
      } else {
        setExplain({ tone: data.tone || '', scene: data.scene || '', localization: data.localization || '', why: data.why || '' });
      }
    } catch {
      setExplain({ tone: '', scene: '', localization: '', why: '暂时无法生成讲解，稍后再试。' });
    } finally {
      setExplainLoading(false);
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
          <option value="fr">法语</option>
          <option value="ru">俄语</option>
          <option value="ar">阿拉伯语</option>
          <option value="pt">葡萄牙语</option>
          <option value="ko">韩语</option>
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
          <option value="fr">法语</option>
          <option value="ru">俄语</option>
          <option value="ar">阿拉伯语</option>
          <option value="pt">葡萄牙语</option>
          <option value="ko">韩语</option>
        </select>
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          <option value="auto">AI 自动判断</option>
          <option value="business">商务翻译</option>
          <option value="academic">学术翻译</option>
          <option value="casual">口语翻译</option>
          <option value="gaming">游戏翻译</option>
          <option value="polish">✨ 润色文字</option>
        </select>
        <button className="primary" onClick={doTranslate} disabled={loading || polishing}>
          {loading ? '处理中…' : scenario === 'polish' ? '润色' : '翻译'}
        </button>
      </div>
      {loggedIn && est !== null && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          预计消耗约 {est} 额度（登录用户按次计费，翻译完成结算）
        </div>
      )}
      <FileTranslator targetLang={targetLang} />
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
          <div className="explain-box">
            <button
              type="button"
              className="explain-toggle"
              onClick={() => {
                const next = !explainOpen;
                setExplainOpen(next);
                if (next) loadExplain();
              }}
            >
              AI为什么这样翻译？ <span className="explain-arrow">{explainOpen ? '▲' : '▼'}</span>
            </button>
            {explainOpen && (
              <div className="explain-content">
                {explainLoading ? (
                  <div className="explain-loading">分析中…</div>
                ) : explain ? (
                  <>
                    {explain.tone && <div className="explain-row"><span className="explain-k">语气</span><span className="explain-v">{explain.tone}</span></div>}
                    {explain.scene && <div className="explain-row"><span className="explain-k">场景</span><span className="explain-v">{explain.scene}</span></div>}
                    {explain.localization && <div className="explain-row"><span className="explain-k">本地化</span><span className="explain-v">{explain.localization}</span></div>}
                    {explain.why && <div className="explain-why">{explain.why}</div>}
                  </>
                ) : (
                  <div className="explain-loading">分析中…</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {promptLogin && (
        <div className="save-prompt" role="status">
          <div className="save-prompt-text">
            <strong>登录即可保存翻译记录</strong>
            <span>跨设备同步，随时回来查看</span>
          </div>
          <button
            className="save-prompt-btn"
            onClick={() => {
              setPromptLogin(false);
              sessionStorage.setItem('aifanyi_login_prompt_dismissed', '1');
              window.dispatchEvent(new CustomEvent('open-login-modal'));
            }}
          >登录保存</button>
          <button
            className="save-prompt-close"
            aria-label="关闭提示"
            onClick={() => {
              setPromptLogin(false);
              sessionStorage.setItem('aifanyi_login_prompt_dismissed', '1');
            }}
          >×</button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}