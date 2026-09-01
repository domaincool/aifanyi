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
          <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "图片翻译免费吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "免费使用。为保障所有用户稳定使用，每日有公平使用上限，注册后额度更高，每日自动重置，合理用量内无需担心。"
              }
            },
            {
              "@type": "Question",
              "name": "支持哪些图片格式？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "支持 PNG、JPG、WebP、GIF，单个文件不超过 5MB。上传后自动识别图片中的文字并翻译。"
              }
            },
            {
              "@type": "Question",
              "name": "图片翻译准确吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "图片先经 AI 视觉模型识别文字（OCR），再由 DeepSeek 翻译，失败时自动降级 GLM，识别与翻译结果并排对照，方便核对。"
              }
            }
          ]
        }) }}
      />
</div>
  );
}
