import type { Metadata } from 'next';
import SubtitleTranslatorClient from './SubtitleTranslatorClient';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/tools/subtitle-translator',
  title: "免费字幕翻译 — SRT/VTT 一键翻译 | 爱翻译",
  description: "爱翻译免费字幕翻译：上传 SRT / VTT 字幕文件，AI 自动翻译成中文或英文，双语对照预览，支持双语 SRT / 纯译文 SRT / TXT 导出。视频字幕本地化利器。",
  keywords: ["字幕翻译","SRT翻译","VTT翻译","视频字幕","字幕本地化","爱翻译"],
  ogType: 'tool',
});

export default function SubtitleTranslatorPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>🎬 字幕翻译</h1>
        <p>上传 SRT / VTT 字幕，AI 逐条翻译，保留时间轴，双语对照预览与导出。</p>
      </section>
      <SubtitleTranslatorClient />
          <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "字幕翻译免费吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "免费在线使用。无需登录每天可翻译 5 个字幕文件，登录后每天 10 个；按字幕时长计积分，约每分钟 10 积分。"
              }
            },
            {
              "@type": "Question",
              "name": "支持哪些字幕格式？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "支持 SRT 和 VTT 格式，单个文件不超过 5MB、不超过 2000 条字幕。上传后 AI 逐条翻译并保留时间轴，支持双语对照预览。"
              }
            },
            {
              "@type": "Question",
              "name": "翻译结果怎么导出？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "支持导出双语 SRT、纯译文 SRT 和 TXT 三种格式，可直接用于视频剪辑软件或播放器加载。"
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
          name: "爱翻译 字幕翻译",
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          description: "免费 SRT/VTT 字幕翻译工具：上传字幕文件 AI 自动翻译，双语对照预览，支持导出双语 SRT 与 TXT。",
          url: 'https://aifanyi.com/tools/subtitle-translator', /* __p0offer__ 积分制下不宣称 price:0 */
        }) }}
      />


      {/* 可见 FAQ（与 FAQPage JSON-LD 一致；Google 要求问答内容页面可见）__p0faq-subtitle-translator__ */}
      <section className="pdf-seo-faq" id="faq" style={{ marginTop: 32 }}>
        <h2>常见问题</h2>
        <div className="pdf-seo-faq-item">
          <h3>字幕翻译免费吗？</h3>
          <p>免费在线使用。无需登录每天可翻译 5 个字幕文件，登录后每天 10 个；按字幕时长计积分，约每分钟 10 积分。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>支持哪些字幕格式？</h3>
          <p>支持 SRT 和 VTT 格式，单个文件不超过 5MB、不超过 2000 条字幕。上传后 AI 逐条翻译并保留时间轴，支持双语对照预览。</p>
        </div>
        <div className="pdf-seo-faq-item">
          <h3>翻译结果怎么导出？</h3>
          <p>支持导出双语 SRT、纯译文 SRT 和 TXT 三种格式，可直接用于视频剪辑软件或播放器加载。</p>
        </div>
      </section>
</div>
  );
}
