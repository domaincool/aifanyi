'use client';

/**
 * 内容页工具 CTA（V1.0 Week3 D15：每页一个工具 CTA + tool_click 埋点，spec §33）
 * V1.1 P1-2：支持任务型 href/label/term；不传时保持原默认行为（向后兼容）
 */
import { sendContentEvent } from '@/lib/metrics/client';

export default function ToolCtaButton({
  contentType,
  contentId,
  label,
  href,
  term,
}: {
  contentType: string;
  contentId: string;
  label?: string;
  href?: string;
  term?: string;
}) {
  const target = href || '/';
  const text = label || (term ? `把含有 ${term} 的句子翻成中文 →` : '把你的句子放进翻译框试试 →');
  return (
    <a
      className="btn primary tool-cta"
      href={target}
      onClick={() => { try { sendContentEvent('tool_click', contentType, contentId); } catch {} }}
    >
      {text}
    </a>
  );
}
