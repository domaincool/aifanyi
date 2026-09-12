import type { Metadata } from 'next';
import ImageTranslatorClient from './ImageTranslatorClient';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/tools/image-translator',
  title: "免费图片翻译 — 截图/海报/菜单一键识别翻译 | 爱翻译",
  description: "爱翻译免费图片翻译：上传截图、海报、菜单、聊天记录等图片，AI 自动识别图中文字并翻译，中英日韩等 10 种语言，注册送积分。",
  keywords: ["图片翻译","截图翻译","OCR翻译","图片识别","爱翻译"],
  ogType: 'tool',
});

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
                "text": "需登录使用。新用户注册送 500 积分，每张图片消耗 3 积分；每日另有公平使用额度，自动重置。"
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: "爱翻译 图片翻译",
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          description: "免费图片翻译工具：上传图片自动识别图中文字并翻译成目标语言。",
          url: 'https://aifanyi.com/tools/image-translator', /* __p0offer__ 积分制下不宣称 price:0 */
        }) }}
      />


      {/* 可见 FAQ（与 FAQPage JSON-LD 一致；Google 要求问答内容页面可见）__p0faq-image-translator__ */}
      <section className="pdf-seo-faq" id="faq" style={{ marginTop: 32 }}>
        <h2>常见问题</h2>
        <div className="pdf-seo-faq-item">
          <h3>图片翻译免费吗？</h3>
          <p>需登录使用。新用户注册送 500 积分，每张图片消耗 3 积分；每日另有公平使用额度，自动重置。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>支持哪些图片格式？</h3>
          <p>支持 PNG、JPG、WebP、GIF，单个文件不超过 5MB。上传后自动识别图片中的文字并翻译。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>图片翻译准确吗？</h3>
          <p>图片先经 AI 视觉模型识别文字（OCR），再由 DeepSeek 翻译，失败时自动降级 GLM，识别与翻译结果并排对照，方便核对。</p>
        </div>
      </section>
</div>
  );
}
