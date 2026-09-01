import type { Metadata } from 'next';
import WebTranslatorClient from './WebTranslatorClient';

export const metadata: Metadata = {
  title: '免费网页翻译 — 整页正文一键翻译 | 爱翻译',
  description: '爱翻译免费网页翻译：输入网址，AI 自动提取网页正文并翻译，段落级双语对照，保留原意与语气。中英日韩等 10 种语言，免费使用。',
  keywords: ['网页翻译', '整页翻译', '网站翻译', '文章翻译', '爱翻译'],
};

export default function WebTranslatorPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>🌐 网页翻译</h1>
        <p>输入网址，AI 提取正文并翻译，段落级双语对照阅读。</p>
      </section>
      <WebTranslatorClient />
          <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "网页翻译免费吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "免费使用。为保障所有用户稳定使用，每日有公平使用上限，注册后额度更高，每日自动重置，合理用量内无需担心。"
              }
            },
            {
              "@type": "Question",
              "name": "怎么翻译一个网页？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "粘贴网页 URL，爱翻译抓取页面正文（过滤导航、页脚等噪声），分段翻译成中文，段落级双语对照显示。"
              }
            },
            {
              "@type": "Question",
              "name": "支持哪些网页？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "支持公开访问的 http/https 网页，单页最多 50 段正文。本地文件、内网地址出于安全考虑不支持。"
              }
            }
          ]
        }) }}
      />
</div>
  );
}
