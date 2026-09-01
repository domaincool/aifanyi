import type { Metadata } from 'next';
import SubtitleTranslatorClient from './SubtitleTranslatorClient';

export const metadata: Metadata = {
  title: '免费字幕翻译 — SRT/VTT 一键翻译 | 爱翻译',
  description: '爱翻译免费字幕翻译：上传 SRT / VTT 字幕文件，AI 自动翻译成中文或英文，双语对照预览，支持双语 SRT / 纯译文 SRT / TXT 导出。视频字幕本地化利器，免费使用。',
  keywords: ['字幕翻译', 'SRT翻译', 'VTT翻译', '视频字幕', '字幕本地化', '爱翻译'],
};

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
                "text": "免费使用。为保障所有用户稳定使用，每日有公平使用上限：游客 5 个文件，注册后升至 10 个文件，每日自动重置，合理用量内无需担心。"
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
</div>
  );
}
