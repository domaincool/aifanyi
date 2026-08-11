import type { Metadata } from 'next';
import SubtitleTranslatorClient from './SubtitleTranslatorClient';

export const metadata: Metadata = {
  title: '字幕翻译 — SRT/VTT 一键翻译 | 爱翻译',
  description: '爱翻译字幕翻译：上传 SRT / VTT 字幕文件，AI 自动翻译成中文或英文，双语对照预览，支持双语 SRT / 纯译文 SRT / TXT 导出。视频字幕本地化利器。',
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
    </div>
  );
}
