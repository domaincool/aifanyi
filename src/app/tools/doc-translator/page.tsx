import type { Metadata } from 'next';
import DocTranslatorClient from './DocTranslatorClient';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/tools/doc-translator',
  title: "免费 Word/PPT 翻译 — 文档一键翻译 | 爱翻译",
  description: "爱翻译免费 Word/PPT 翻译：上传 .docx / .pptx 文档，AI 自动提取文字并翻译，段落级双语对照，保留文档结构。中英日韩等 10 种语言，注册送积分。",
  keywords: ["Word翻译","PPT翻译","文档翻译","docx翻译","pptx翻译","爱翻译"],
  ogType: 'tool',
});

export default function DocTranslatorPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>📝 Word / PPT 翻译</h1>
        <p>上传 Word / PPT 文档，AI 提取文字并翻译，段落级双语对照。</p>
      </section>
      <DocTranslatorClient />
          <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Word/PPT 翻译免费吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "当前为免费体验阶段（需登录使用）。新用户注册送 500 积分，按正文长度计积分（约每千字 20 积分）；每日另有公平使用额度，自动重置。"
              }
            },
            {
              "@type": "Question",
              "name": "支持哪些格式？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "支持 .docx 和 .pptx，单个文件不超过 10MB、不超过 300 段。自动识别标题、段落、列表、表格结构，按结构翻译。"
              }
            },
            {
              "@type": "Question",
              "name": "能保留原格式吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "当前版本提供段落级双语对照与全文复制，识别标题/列表/表格并标注类型，方便在原文档中对照修改。"
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
          name: "爱翻译 Word/PPT 翻译",
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          description: "免费 Word/PPT 文档翻译工具：上传 docx/pptx 保留结构翻译，段落级双语对照。",
          url: 'https://aifanyi.com/tools/doc-translator', /* __p0offer__ 积分制下不宣称 price:0 */
        }) }}
      />


      {/* 可见 FAQ（与 FAQPage JSON-LD 一致；Google 要求问答内容页面可见）__p0faq-doc-translator__ */}
      <section className="pdf-seo-faq" id="faq" style={{ marginTop: 32 }}>
        <h2>常见问题</h2>
        <div className="pdf-seo-faq-item">
          <h3>Word/PPT 翻译免费吗？</h3>
          <p>当前为免费体验阶段（需登录使用）。新用户注册送 500 积分，按正文长度计积分（约每千字 20 积分）；每日另有公平使用额度，自动重置。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>支持哪些格式？</h3>
          <p>支持 .docx 和 .pptx，单个文件不超过 10MB、不超过 300 段。自动识别标题、段落、列表、表格结构，按结构翻译。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>能保留原格式吗？</h3>
          <p>当前版本提供段落级双语对照与全文复制，识别标题/列表/表格并标注类型，方便在原文档中对照修改。</p>
        </div>
      </section>
</div>
  );
}
