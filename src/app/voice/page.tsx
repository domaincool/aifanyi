import type { Metadata } from 'next';
import VoiceRouter from '@/components/voice/VoiceRouter';

export const metadata: Metadata = {
  title: '面对面语音翻译 — 爱翻译 · AI翻译',
  description: '面对面语音翻译：一方说中文、一方说英文，自动识别并翻译，说一句译一句，适合跨语言交流场景。',
};

// 强制按请求动态渲染：极简头部 CSS 保底依赖 SSR
export const dynamic = 'force-dynamic';

export default function VoicePage() {
  return (
    <>
      {/* 极简头部保底：SSR 首屏即隐藏导航与主题切换 */}
      <style>{'.site-header nav, .site-header .theme-toggle { display: none !important; }'}</style>
      <VoiceRouter />
    </>
  );
}
