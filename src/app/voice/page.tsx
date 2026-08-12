import type { Metadata } from 'next';
import { headers } from 'next/headers';
import VoiceRouter from '@/components/voice/VoiceRouter';

export const metadata: Metadata = {
  title: '面对面语音翻译 — 爱翻译 · AI翻译',
  description: '面对面语音翻译：一方说中文、一方说英文，自动识别并翻译，说一句译一句，适合跨语言交流场景。',
};

// 强制按请求动态渲染：极简头部 CSS 保底依赖 SSR
export const dynamic = 'force-dynamic';

export default async function VoicePage() {
  // SSR 阶段用 UA 判定初始视图（桌面双面板 / 移动单手），横竖屏旋转由客户端修正
  const ua = (await headers()).get('user-agent') || '';
  const ssrMobile = /Mobile|Android|iPhone|iPod/i.test(ua);
  return (
    <>
      {/* 极简头部保底：SSR 首屏即隐藏导航与主题切换 */}
      <style>{'.site-header nav, .site-header .theme-toggle { display: none !important; } .voice-record-btn, .voice-record-btn * { -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; -webkit-tap-highlight-color: transparent; }'}</style>
      <VoiceRouter ssrMobile={ssrMobile} />
    </>
  );
}
