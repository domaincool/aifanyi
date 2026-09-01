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
    </div>
  );
}
