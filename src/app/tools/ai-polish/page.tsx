import type { Metadata } from 'next';
import PolishClient from './PolishClient';

export const metadata: Metadata = {
  title: '免费 AI 润色 — 让文字更自然地道 | 爱翻译',
  description: '爱翻译免费 AI 润色：粘贴译文或草稿，AI 保持原意优化表达，让文字更自然、更地道。支持中英文等 10 种语言，免费使用。',
  keywords: ['AI润色', '文字润色', '译文优化', '改写', '爱翻译'],
};

export default function AiPolishPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>✨ AI 润色</h1>
        <p>粘贴译文或草稿，AI 保持原意、优化表达，让文字更自然地道。</p>
      </section>
      <PolishClient />
    </div>
  );
}
