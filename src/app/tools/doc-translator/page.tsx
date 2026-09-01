import type { Metadata } from 'next';
import DocTranslatorClient from './DocTranslatorClient';

export const metadata: Metadata = {
  title: '免费 Word/PPT 翻译 — 文档一键翻译 | 爱翻译',
  description: '爱翻译免费 Word/PPT 翻译：上传 .docx / .pptx 文档，AI 自动提取文字并翻译，段落级双语对照，保留文档结构。中英日韩等 10 种语言，免费使用。',
  keywords: ['Word翻译', 'PPT翻译', '文档翻译', 'docx翻译', 'pptx翻译', '爱翻译'],
};

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
                "text": "免费使用。为保障所有用户稳定使用，每日有公平使用上限，注册后额度更高，每日自动重置，合理用量内无需担心。"
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
</div>
  );
}
