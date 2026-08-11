import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '翻译工具 — 一站式 AI 翻译工具 | 爱翻译',
  description: '爱翻译翻译工具：PDF 翻译、图片翻译、字幕翻译、网页翻译、Word/PPT 翻译、AI 润色。不管是一句话、一份 PDF，还是一整段视频字幕，都能交给 AI。',
  keywords: ['PDF翻译', '图片翻译', '字幕翻译', '网页翻译', 'Word翻译', 'PPT翻译', 'AI润色', 'AI翻译工具'],
};

const tools = [
  {
    id: 'pdf',
    emoji: '📄',
    name: 'PDF 翻译 · 三模型对比',
    desc: 'DeepSeek/GLM/Google 三模型对比，双语对照阅读，支持 DOCX/TXT 下载 · 免费额度',
    action: '开始翻译 →',
  },
  {
    id: 'image',
    emoji: '🖼',
    name: '图片翻译',
    desc: '自动识别图片文字并翻译',
    action: '上传图片 →',
  },
  {
    id: 'subtitle',
    emoji: '🎬',
    name: '字幕翻译',
    desc: 'SRT / VTT 字幕一键翻译，双语对照，保留时间轴，免费额度',
    action: '翻译字幕 →',
  },
  {
    id: 'web',
    emoji: '🌐',
    name: '网页翻译',
    desc: '翻译整个网页，保留原始语境',
    action: '翻译网页 →',
  },
  {
    id: 'doc',
    emoji: '📝',
    name: 'Word / PPT',
    desc: '文档内容快速本地化',
    action: '上传文档 →',
  },
  {
    id: 'polish',
    emoji: '✨',
    name: 'AI润色',
    desc: '译文/草稿 AI 润色，保持原意、表达更地道',
    action: '开始润色 →',
  },
];

export default function ToolsPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>📚 一站式 AI 翻译工具</h1>
        <p>不管是一句话、一份 PDF，还是一整段视频字幕，都能交给 AI。</p>
      </section>
      <section className="tools-grid">
        {tools.map((t) => {
          const live = t.id === 'pdf' || t.id === 'subtitle' || t.id === 'polish';
          return (
            <div className="tool-card" key={t.id} id={t.id}>
              <div className="tool-emoji">{t.emoji}</div>
              <h2>{t.name}</h2>
              <p>{t.desc}</p>
              <a className="tool-btn" href={live ? (t.id === 'subtitle' ? '/tools/subtitle-translator' : t.id === 'polish' ? '/tools/ai-polish' : '/tools/pdf-translator') : '#'}>
                {t.action}
                {live ? <span className="tool-soon tool-live">可用</span> : <span className="tool-soon">即将上线</span>}
              </a>
            </div>
          );
        })}
      </section>
    </div>
  );
}