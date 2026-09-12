'use client';

/**
 * Ask AIFANYI —— 统一语言问题入口（V1.0 D12 + P7 裁决：L1 规则路由 + L2 内容库匹配）
 * 用户输入任何语言问题：
 *  L1 规则：「什么意思/啥意思/mean」→ Meaning；「怎么说/怎么讲/how to say」→ Speak(travel)；
 *          「潜台词/言外之意/是不是在」→ Hidden Meaning（暂 Meaning）；其他 → 翻译框
 *  L2 匹配：跳转 /understand/meaning?q= 服务端五表查询（精确命中渲染快答）
 * V1 从首页 hero 进入；L3 AI 分类在 Week 4 接入（本组件的 action 结构已预留）
 */
import { useState } from 'react';
import { sendContentEvent, getContentSessionId } from '@/lib/metrics/client';

type Intent = 'translate' | 'meaning' | 'speak';

function classify(q: string): Intent {
  const s = q.toLowerCase();
  if (/什么意思|啥意思|是什么|什麼意思|mean|meaning/.test(s)) return 'meaning';
  if (/怎么说|怎么讲|怎么表达|how to say|how do i say/.test(s)) return 'speak';
  if (/潜台词|言外之意|是不是在|暗示/.test(s)) return 'meaning';
  return 'translate';
}

export default function AskAifanyi() {
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
    // 埋点：intent 路由（contentId 带 intent 与来源便于日聚合区分）
    // __p0ask__ query 级埋点：query 前 160 字符 + intent + 命中来源（L1/L3），支撑「用户到底在问什么」分析
    try {
      // __p0fix-kpi__ contentId 必须有界：只记 intent|via，避免用户原文写入 ContentMetrics 主键污染聚合
      sendContentEvent('tool_click', 'ask_query', intent + '|' + via);
    } catch {}
    try { sendContentEvent('tool_click', 'ask_aifanyi', via === 'l3' ? intent + '_ai' : intent); } catch {}
    if (intent === 'meaning') {
      // L2：内容库匹配（服务端五表查询 + 精确命中快答）
      window.location.href = '/understand/meaning?q=' + encodeURIComponent(query);
    } else if (intent === 'speak') {
      // V1：Speak 场景页检索（/travel 场景库 90 条）
      window.location.href = '/understand/meaning?q=' + encodeURIComponent(query);
    } else {
      // translate：进翻译框（保留 query 预填体验）
      window.location.href = '/?q=' + encodeURIComponent(query);
    }
  };

  return (
    <div className="ask-aifanyi">
      <form className="filter-bar ask-bar" onSubmit={go}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask AIFANYI：cringe 是什么意思？/ 帮我把这句话翻得像美国人" // __p0ask-brand__
          aria-label="Ask AIFANYI：问一个语言问题"
        />
        <button type="submit" className="btn primary" disabled={busy}>立即解决</button>
      </form>
      <div className="ask-hints">
        <span>试试：</span>
        <button onClick={() => setQ('cringe 是什么意思？')}>cringe 是什么意思？</button>
        <button onClick={() => setQ('I need some space 是什么意思？')}>I need some space 是什么意思？</button>
        <button onClick={() => setQ('餐厅点餐怎么说？')}>餐厅点餐怎么说？</button>
      </div>
    </div>
  );
}
