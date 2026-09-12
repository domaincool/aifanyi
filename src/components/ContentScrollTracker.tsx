'use client';

import { useEffect } from 'react';
import { sendContentEvent } from '@/lib/metrics/client';

/** 内容页阅读深度埋点（九事件之 content_scroll）：50% / 90% 各上报一次 */
export default function ContentScrollTracker({ contentType, contentId }: { contentType: string; contentId: string }) {
  useEffect(() => {
    const marks = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = (window.scrollY / total) * 100;
      for (const m of [50, 90]) if (pct >= m && !marks.has(m)) { marks.add(m); sendContentEvent('content_scroll', contentType, contentId); }
      if (marks.size === 2) window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [contentType, contentId]);
  return null;
}
