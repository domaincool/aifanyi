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
    </div>
  );
}
