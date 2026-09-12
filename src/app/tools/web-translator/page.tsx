import type { Metadata } from 'next';
import WebTranslatorClient from './WebTranslatorClient';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/tools/web-translator',
  title: "免费网页翻译 — 整页正文一键翻译 | 爱翻译",
  description: "爱翻译免费网页翻译：输入网址，AI 自动提取网页正文并翻译，段落级双语对照，保留原意与语气。中英日韩等 10 种语言，注册送积分。",
  keywords: ["网页翻译","整页翻译","网站翻译","文章翻译","爱翻译"],
  ogType: 'tool',
});

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
                "text": "需登录使用。新用户注册送 500 积分，按正文长度计积分（约每千字 2 积分）；每日另有公平使用额度，自动重置。"
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: "爱翻译 网页翻译",
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          description: "免费网页翻译工具：输入网址即可翻译整页内容，段落级双语对照阅读。",
          url: 'https://aifanyi.com/tools/web-translator', /* __p0offer__ 积分制下不宣称 price:0 */
        }) }}
      />


      {/* 可见 FAQ（与 FAQPage JSON-LD 一致；Google 要求问答内容页面可见）__p0faq-web-translator__ */}
      <section className="pdf-seo-faq" id="faq" style={{ marginTop: 32 }}>
        <h2>常见问题</h2>
        <div className="pdf-seo-faq-item">
          <h3>网页翻译免费吗？</h3>
          <p>需登录使用。新用户注册送 500 积分，按正文长度计积分（约每千字 2 积分）；每日另有公平使用额度，自动重置。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>怎么翻译一个网页？</h3>
          <p>粘贴网页 URL，爱翻译抓取页面正文（过滤导航、页脚等噪声），分段翻译成中文，段落级双语对照显示。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>支持哪些网页？</h3>
          <p>支持公开访问的 http/https 网页，单页最多 50 段正文。本地文件、内网地址出于安全考虑不支持。</p>
        </div>
      </section>
</div>
  );
}
