'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendContentEvent } from '@/lib/metrics/client';
import { FAIR_USE_PAUSED_MSG } from '@/lib/credit/feature-flags';

/**
 * 「怎么说？」工具（V1.1 P1-1）
 * 与「翻译」的心智区分：翻译 = 把一句话变成另一种语言；怎么说？ = 这个场景当地人怎么开口。
 * 因此只有目标语言选择（无源语言、无交换按钮），按钮为「怎么说？」，输出六张表达卡。
 */

type TargetLang = 'en' | 'ja' | 'ko' | 'es';

const LANGS: { code: TargetLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
];

const EXAMPLES = ['拒绝别人的邀约', '催别人回复但别显得急', '面试时问薪资', '委婉地表达不同意'];

const BLOCK_META: { key: 'natural' | 'casual' | 'formal' | 'native' | 'context' | 'example'; title: string }[] = [
  { key: 'natural', title: '自然表达' },
  { key: 'casual', title: '更口语' },
  { key: 'formal', title: '更正式' },
  { key: 'native', title: '更像当地人' },
  { key: 'context', title: '使用场景' },
  { key: 'example', title: '例句' },
];

type Blocks = { natural: string; casual: string; formal: string; native: string; context: string; example: string };

export default function SpeakTool({ initialQuery = '' }: { initialQuery?: string }) {
  const [text, setText] = useState(initialQuery);
  const [targetLang, setTargetLang] = useState<TargetLang>('en');
  const [loading, setLoading] = useState(false);
  const [blocks, setBlocks] = useState<Blocks | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [err, setErr] = useState<{ code: string; msg: string } | null>(null);
  const [usedCredits, setUsedCredits] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  const [estCredits, setEstCredits] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState('');
  const estTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 提交前估值（服务端算价，前端永不算价）：debounce 400ms
  useEffect(() => {
    if (estTimer.current) clearTimeout(estTimer.current);
    const t = text.trim();
    if (t.length < 2 || t.length > 200) {
      setEstCredits(null);
      return;
    }
    estTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/speak?text=' + encodeURIComponent(t) + '&targetLang=' + targetLang);
        const d = await res.json();
        if (d && d.ok) {
          setPaused(d.deductionEnabled === false);
          setEstCredits(typeof d.estimatedCredits === 'number' ? d.estimatedCredits : null);
        }
      } catch {}
    }, 400);
    return () => {
      if (estTimer.current) clearTimeout(estTimer.current);
    };
  }, [text, targetLang]);

  const run = useCallback(async (raw: string, lang: TargetLang) => {
    const q = raw.trim();
    if (q.length < 2 || q.length > 200) {
      setBlocks(null);
      setErr({ code: 'invalid_input', msg: '请用一句话描述你想表达的意思（200 字以内）。' });
      return;
    }
    setLoading(true);
    setErr(null);
    setBlocks(null);
    setUsedCredits(null);
    setCached(false);
    sendContentEvent('tool_click', 'speak', lang);
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: q, targetLang: lang }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d || !d.ok) {
        const code =
          (d && d.code) ||
          (res.status === 401 ? 'auth_required' : res.status === 402 ? 'insufficient' : res.status === 429 ? 'rate_limited' : res.status === 502 ? 'model_failed' : 'server_error');
        const msg =
          (d && d.error) ||
          (res.status === 502 ? '没能生成地道说法，请换个说法再试（本次不消耗积分）。' : '服务器错误，请稍后再试。');
        setErr({ code, msg });
        return;
      }
      setBlocks(d.blocks);
      setDegraded(!!d.degraded);
      setCached(!!d.cached);
      setUsedCredits(typeof d.credits === 'number' ? d.credits : 0);
      if (typeof d.deductionEnabled === 'boolean') setPaused(d.deductionEnabled === false);
      sendContentEvent('translation_complete', 'speak', lang);
    } catch {
      setErr({ code: 'server_error', msg: '服务器错误，请稍后再试。' });
    } finally {
      setLoading(false);
    }
  }, []);

  async function copyText(key: string, val: string) {
    try {
      await navigator.clipboard.writeText(val);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = val;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  }

  const creditLine = paused ? FAIR_USE_PAUSED_MSG : estCredits !== null ? `预计使用 ${estCredits} 积分` : '';
  const usedLine = cached ? '本次使用 0 积分（缓存命中）' : paused ? FAIR_USE_PAUSED_MSG : `本次使用 ${usedCredits ?? 0} 积分`;

  return (
    <section className="speak-tool">
      <p className="speak-intro">
        翻译是把一句话变成另一种语言；「怎么说？」是让 AI 告诉你，这个场景当地人通常怎么开口。
      </p>
      <form
        className="speak-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(text, targetLang);
        }}
      >
        <div className="speak-row">
          <select
            className="speak-select"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value as TargetLang)}
            aria-label="目标语言"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            className="speak-input"
            type="text"
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder="用中文说出你想表达的意思，例：我想委婉地拒绝别人"
            aria-label="用中文说出你想表达的意思"
          />
          <button className="btn primary speak-submit" type="submit" disabled={loading}>
            {loading ? '生成中…' : '怎么说？'}
          </button>
        </div>
      </form>

      {!loading && creditLine ? <div className="speak-credit">{creditLine}</div> : null}

      {!loading && !blocks && !err ? (
        <div className="speak-examples">
          <span>试试：</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                run(ex, targetLang);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="speak-skeleton-wrap">
          <p className="speak-skeleton-tip">正在找当地人的说法…</p>
          <div className="speak-grid">
            {BLOCK_META.map((b) => (
              <div
                key={b.key}
                className={'speak-skeleton' + (b.key === 'context' || b.key === 'example' ? ' speak-wide' : '')}
              />
            ))}
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="speak-error" role="alert">
          <p>{err.msg}</p>
          {err.code === 'auth_required' ? (
            <button
              className="btn primary"
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
            >
              登录 / 免费注册
            </button>
          ) : null}
          {err.code === 'insufficient' ? (
            <a className="btn" href="/credit">
              查看积分
            </a>
          ) : null}
          {err.code === 'model_failed' ? (
            <button className="btn" type="button" onClick={() => run(text, targetLang)}>
              重试
            </button>
          ) : null}
          {err.code === 'model_failed' ? <span className="speak-note">本次不消耗积分</span> : null}
        </div>
      ) : null}

      {blocks && !loading ? (
        <div className="speak-result">
          {degraded ? (
            <div className="speak-degraded">当前仅给出直译，地道说法暂不可用 —— 可稍后再试。</div>
          ) : null}
          <div className="speak-grid">
            {BLOCK_META.map((b) => {
              const val = blocks[b.key];
              if (!val) return null;
              const wide = b.key === 'context' || b.key === 'example';
              return (
                <div key={b.key} className={'speak-card' + (wide ? ' speak-wide' : '')}>
                  <div className="speak-card-head">
                    <span className="speak-card-title">{b.title}</span>
                    <button className="speak-copy" type="button" onClick={() => copyText(b.key, val)}>
                      {copied === b.key ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className={'speak-card-body' + (b.key === 'example' ? ' speak-pre' : '')}>{val}</div>
                </div>
              );
            })}
          </div>
          {usedLine ? <div className="speak-used">{usedLine}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
