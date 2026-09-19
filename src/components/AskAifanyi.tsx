'use client';

/**
 * Ask AIFANYI — 统一语言问题入口（hub 页挂载版）
 * L1 规则路由：潜台词/言外之意 → Hidden Meaning（复用 meaning 检索）；是什么意思 → Meaning；怎么说/怎么说 → Speak；其他 → 翻译框
 * L3：/api/ask/classify AI 意图分流（8s 超时降级 translate）
 * 降级：form action=/understand/meaning + input name=q —— JS 水合失败时原生 GET 跳转（受控 value 仅作初始值，不阻碍降级）
 * Props：hints（「试试」按钮词面，按板块语境）、placeholder（板块化提示）
 */
import { useState } from 'react';
import { sendContentEvent, sendIntentEvent, getContentSessionId } from '@/lib/metrics/client';

type Intent = 'translate' | 'meaning' | 'speak' | 'hidden_meaning';

function classify(q: string): Intent {
  const s = q.toLowerCase();
  if (/潜台词|言外之意|是不是在|暗示/.test(s)) return 'hidden_meaning';
  if (/什么意思|啥意思|是什么|什么梗|mean|meaning/.test(s)) return 'meaning';
  if (/怎么说|怎么讲|怎么表达|怎么翻译|用.{0,8}(英语|英文|说)|how to say|how do (i|you) say/.test(s)) return 'speak';
  return 'translate';
}

export default function AskAifanyi({ hints, placeholder }: { hints?: string[]; placeholder?: string }) {
  const defaultHints = hints && hints.length ? hints : ['cringe 是什么意思？', 'I need some space 是什么意思？', '餐厅点餐怎么说？'];
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true);
    let intent: Intent = classify(query);
    let via = 'l1';
    if (intent === 'translate') {
      // L1 未命中 → L3 AI 意图分类（服务端缓存 + 8s 超时降级 translate）
      try {
        const r = await fetch('/api/ask/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d?.ok && (d.intent === 'meaning' || d.intent === 'speak' || d.intent === 'translate')) {
            intent = d.intent;
            via = d.raw === 'l1' ? 'l1' : 'l3';
          }
        }
      } catch {}
    }
    try {
      sendContentEvent('tool_click', 'ask_query', intent + '|' + via);
    } catch {}
    try {
      sendIntentEvent({
        query,
        intent,
        confidence: via === 'l1' ? 0.9 : 0.6,
        sessionKey: getContentSessionId(),
      });
    } catch {}
    try { sendContentEvent('tool_click', 'ask_aifanyi', via === 'l3' ? intent + '_ai' : intent); } catch {}
    if (intent === 'hidden_meaning') {
      window.location.href = '/understand/meaning?q=' + encodeURIComponent(query);
    } else if (intent === 'meaning') {
      window.location.href = '/understand/meaning?q=' + encodeURIComponent(query);
    } else if (intent === 'speak') {
      window.location.href = '/speak?q=' + encodeURIComponent(query);
    } else {
      window.location.href = '/?q=' + encodeURIComponent(query);
    }
  };

  return (
    <div className="ask-aifanyi">
      <form className="filter-bar ask-bar" action="/understand/meaning" method="get" onSubmit={go}>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // __p0ask-brand__
          placeholder={placeholder || 'Ask AIFANYI：cringe 是什么意思？/ 帮我把这句话翻得像美国人'}
          aria-label="Ask AIFANYI：问一个语言问题"
        />
        <button type="submit" className="btn primary" disabled={busy}>立即解决</button>
      </form>
      <div className="ask-hints">
        <span>试试：</span>
        {defaultHints.map((h) => (
          <button key={h} onClick={() => { setQ(h); }}>{h}</button>
        ))}
      </div>
    </div>
  );
}
