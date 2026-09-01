import type { Metadata } from 'next';
import ImageTranslatorClient from './ImageTranslatorClient';

export const metadata: Metadata = {
  title: '免费图片翻译 — 截图/海报/菜单一键识别翻译 | 爱翻译',
  description: '爱翻译免费图片翻译：上传截图、海报、菜单、聊天记录等图片，AI 自动识别图中文字并翻译，中英日韩等 10 种语言，免费使用。',
  keywords: ['图片翻译', '截图翻译', 'OCR翻译', '图片识别', '爱翻译'],
};

export default function ImageTranslatorPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>🖼 图片翻译</h1>
        <p>上传截图、海报、菜单、聊天记录，AI 识别图中文字并翻译，逐行对照。</p>
      </section>
      <ImageTranslatorClient />
    </div>
  );
}
