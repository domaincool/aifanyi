import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PDF翻译 - 免费在线PDF翻译成中文 | 三模型对比 | 爱翻译AI翻译',
  description: '免费PDF在线翻译工具：上传PDF翻译成中文/英文，DeepSeek/GLM/Google三模型对比，双语对照阅读，保留标题列表结构，可下载DOCX/TXT。新用户注册送500免费积分，翻译成功才扣费，失败自动退回。',
  keywords: 'PDF翻译,PDF在线翻译,PDF翻译成中文,英文PDF翻译成中文,免费PDF翻译,PDF翻译工具,AI翻译PDF,在线PDF翻译器',
};

export default function PdfTranslatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}