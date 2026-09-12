import type { Metadata } from 'next';
import PolishClient from './PolishClient';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/tools/ai-polish',
  title: "免费 AI 润色 — 让文字更自然地道 | 爱翻译",
  description: "爱翻译免费 AI 润色：粘贴译文或草稿，AI 保持原意优化表达，让文字更自然、更地道。支持中英文等 10 种语言。",
  keywords: ["AI润色","文字润色","译文优化","改写","爱翻译"],
  ogType: 'tool',
});

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
                "text": "文本润色免费用；每日有公平使用上限，注册送 500 积分后可在翻译、润色、文件翻译间通用。"
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: "爱翻译 AI 润色",
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          description: "免费 AI 润色工具：保持原意优化表达，支持中英文等 10 种语言。",
          url: 'https://aifanyi.com/tools/ai-polish', /* __p0offer__ 积分制下不宣称 price:0 */
        }) }}
      />


      {/* 可见 FAQ（与 FAQPage JSON-LD 一致；Google 要求问答内容页面可见）__p0faq-ai-polish__ */}
      <section className="pdf-seo-faq" id="faq" style={{ marginTop: 32 }}>
        <h2>常见问题</h2>
        <div className="pdf-seo-faq-item">
          <h3>AI 润色免费吗？</h3>
          <p>文本润色免费用；每日有公平使用上限，注册送 500 积分后可在翻译、润色、文件翻译间通用。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>润色和翻译有什么区别？</h3>
          <p>润色不改变语言，只优化表达：修正语病、提升用词与流畅度，适合邮件、文案、论文等场景。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>支持哪些语言润色？</h3>
          <p>支持中英文互译场景的同语言润色（中文润色中文、英文润色英文），保留原文意思的同时让表达更自然。</p>
        </div>
      </section>
</div>
  );
}
