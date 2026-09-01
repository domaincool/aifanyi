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
          <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "AI 润色免费吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "免费使用。为保障所有用户稳定使用，每日有公平使用上限，注册后额度更高，每日自动重置，合理用量内无需担心。"
              }
            },
            {
              "@type": "Question",
              "name": "润色和翻译有什么区别？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "润色不改变语言，只优化表达：修正语病、提升用词与流畅度，适合邮件、文案、论文等场景。"
              }
            },
            {
              "@type": "Question",
              "name": "支持哪些语言润色？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "支持中英文互译场景的同语言润色（中文润色中文、英文润色英文），保留原文意思的同时让表达更自然。"
              }
            }
          ]
        }) }}
      />
</div>
  );
}
