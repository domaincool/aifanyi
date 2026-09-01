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
  th: 'ไทย',
  it: 'Italiano',
  vi: 'Tiếng Việt',
  tr: 'Türkçe',
  id: 'Bahasa Indonesia',
  el: 'Ελληνικά',
  nl: 'Nederlands',
  hi: 'हिन्दी',
  pl: 'Polski',
};
/** 轻量语言检测（启发式字符集判定，零依赖零成本）
 * 返回 'zh'|'en'|'ja'|'ko'|'ru'|'ar'|'th'|'el'|'vi' 或 null（无法识别/文本过短）
 */
function detectLang(s: string): string | null {
  const t = s.trim();
  if (t.length < 2) return null; // 过短无法可靠判定
  let han = 0, kana = 0, hangul = 0, cyrillic = 0, arabic = 0, latin = 0, thai = 0, greek = 0, viet = 0, devanagari = 0;
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x4e00 && c <= 0x9fff) han++;
    else if (c >= 0x3040 && c <= 0x30ff) kana++;
    else if (c >= 0xac00 && c <= 0xd7af) hangul++;
    else if (c >= 0x0400 && c <= 0x04ff) cyrillic++;
    else if (c >= 0x0600 && c <= 0x06ff) arabic++;
    else if (c >= 0x0e00 && c <= 0x0e7f) thai++; // 泰文
    else if (c >= 0x0370 && c <= 0x03ff) greek++; // 希腊文
    else if (c >= 0x1e00 && c <= 0x1eff) viet++; // 拉丁扩展附加（越南语 ế/ồ/ạ 等）
    else if (c >= 0x0900 && c <= 0x097f) devanagari++; // 天城文（印地语）
    else if (/[a-zA-Z]/.test(ch)) latin++;
  }
  const total = han + kana + hangul + cyrillic + arabic + thai + greek + viet + devanagari + latin;
  if (total === 0) return null; // 纯符号/数字
  if (kana > 0) return 'ja'; // 含假名 → 日语（日语文本常含汉字+假名，优先判）
  if (han > 0 && hangul === 0) return 'zh';
  if (hangul > 0) return 'ko';
  if (cyrillic > 0) return 'ru';
  if (arabic > 0) return 'ar';
  if (thai > 0) return 'th'; // 泰文独特字符集，优先度高
  if (greek > 0) return 'el'; // 希腊文独特字符集，优先度高
  if (devanagari > 0) return 'hi'; // 天城文 → 印地语
  if (viet > 0) return 'vi'; // 拉丁扩展附加字符 → 越南语
  if (latin > 0) return 'en'; // 拉丁字母 → 英语（德法西葡波等归英，可手动覆盖）
  return null;
}

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
  th: 'th-TH',
  it: 'it-IT',
  vi: 'vi-VN',
  tr: 'tr-TR',
  id: 'id-ID',
  el: 'el-GR',
  nl: 'nl-NL',
  hi: 'hi-IN',
  pl: 'pl-PL',
};

const LANG_GROUPS: { label: string; items: { code: string; name: string }[] }[] = [
  { label: '常用', items: [
    { code: 'zh', name: '中文' }, { code: 'en', name: '英语' }, { code: 'ja', name: '日语' },
    { code: 'ko', name: '韩语' }, { code: 'fr', name: '法语' }, { code: 'de', name: '德语' },
  ]},
  { label: '欧洲', items: [
    { code: 'es', name: '西班牙语' }, { code: 'it', name: '意大利语' }, { code: 'pt', name: '葡萄牙语' },
    { code: 'ru', name: '俄语' }, { code: 'nl', name: '荷兰语' }, { code: 'el', name: '希腊语' }, { code: 'pl', name: '波兰语' },
  ]},
  { label: '亚洲', items: [
    { code: 'th', name: '泰语' }, { code: 'vi', name: '越南语' }, { code: 'tr', name: '土耳其语' },
    { code: 'ar', name: '阿拉伯语' }, { code: 'id', name: '印尼语' }, { code: 'hi', name: '印地语' },
  ]},
];

export default function TranslatorBox({
  defaultSourceLang = 'auto',
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
  const [loggedIn, setLoggedIn] = useState(false); // 登录态
  const [est, setEst] = useState<number | null>(null);
  const estTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [readState, setReadState] = useState<'idle' | 'playing' | 'paused'>('idle'); // 输入朗读状态

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

  // 输入朗读：播放 / 暂停 / 继续 / 停止（Web Speech API）
  function stopRead() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setReadState('idle');
  }

  function toggleRead() {
    if (!text.trim()) {
      showToast('请输入要朗读的内容');
      return;
    }
    if (!('speechSynthesis' in window)) {
      showToast('当前浏览器不支持朗读');
      return;
    }
    // 播放中 → 暂停；暂停中 → 继续
    if (readState === 'playing') {
      window.speechSynthesis.pause();
      setReadState('paused');
      return;
    }
    if (readState === 'paused') {
      window.speechSynthesis.resume();
      setReadState('playing');
      return;
    }
    // 确定朗读语言：auto 时跟随检测结果
    let lang = sourceLang;
    if (lang === 'auto') {
      const detected = detectLang(text);
      if (!detected) {
        showToast('未能识别输入语言，请手动选择源语言');
        return;
      }
      lang = detected;
    }
    window.speechSynthesis.cancel(); // 清掉可能残留的旧朗读
    const u = new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANG[lang] || 'en-US';
    u.rate = 1;
    u.onend = () => setReadState('idle');
    u.onerror = () => { setReadState('idle'); showToast('朗读中断'); };
    window.speechSynthesis.speak(u);
    setReadState('playing');
  }

  async function doTranslate() {
    if (!text.trim()) return;
    let effectiveSource = sourceLang;
    if (sourceLang === 'auto') {
      const detected = detectLang(text);
      if (!detected) {
        showToast('未能识别输入语言，请手动选择源语言');
        return;
      }
      effectiveSource = detected;
    }
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
          sourceLang: effectiveSource,
          targetLang: scenario === 'polish' ? effectiveSource : targetLang,
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
      <div style={{ position: 'relative' }}>
        <textarea
          placeholder="输入要翻译的内容…（示例：这款无线耳机降噪效果一流，续航 30 小时）"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (readState !== 'idle') stopRead(); // 输入变化停止朗读
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            display: 'flex',
            gap: 8,
            zIndex: 2,
          }}
        >
          <button
            type="button"
            className={"read-btn" + (readState !== 'idle' ? " read-btn-active" : "")}
            onClick={toggleRead}
            title={readState === 'playing' ? '暂停朗读' : readState === 'paused' ? '继续朗读' : '朗读输入内容'}
            aria-label={readState === 'playing' ? '暂停朗读' : readState === 'paused' ? '继续朗读' : '朗读输入内容'}
          >
            {readState === 'playing' ? '⏸ 暂停' : readState === 'paused' ? '▶ 继续' : '🔊 朗读'}
          </button>
          {readState !== 'idle' && (
            <button
              type="button"
              className="read-btn read-btn-stop"
              onClick={stopRead}
              title="停止朗读"
              aria-label="停止朗读"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="row">
        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
          <option value="auto">自动检测</option>
          {LANG_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((it) => (
                <option key={it.code} value={it.code}>{it.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className="swap-btn"
          title="交换语言"
          aria-label="交换源语言和目标语言"
          onClick={() => {
            if (sourceLang === 'auto') {
              // 自动检测时交换：源语言取当前目标语言，目标语言回退中文
              setSourceLang(targetLang);
              setTargetLang('zh');
            } else {
              setSourceLang(targetLang);
              setTargetLang(sourceLang);
            }
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
          {LANG_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((it) => (
                <option key={it.code} value={it.code}>{it.name}</option>
              ))}
            </optgroup>
          ))}
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