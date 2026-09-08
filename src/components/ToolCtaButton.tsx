'use client';

/**
 * 内容页工具 CTA（V1.0 Week3 D15：每页一个工具 CTA + tool_click 埋点，spec §33）
 */
import { sendContentEvent } from '@/lib/metrics/client';

export default function ToolCtaButton({ contentType, contentId, label }: { contentType: string; contentId: string; label?: string }) {
  return (
    <a
      className="btn primary tool-cta"
      href="/"
      onClick={() => { try { sendContentEvent('tool_click', contentType, contentId); } catch {} }}
    >
      {label || '把你的句子放进翻译框试试 →'}
    </a>
  );
}
