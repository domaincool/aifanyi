import type { Metadata } from 'next';
import VoicePageClient from '@/components/VoicePageClient';

// 强制按请求动态渲染：usePathname 在 layout 中才能拿到真实路径（/voice 极简头部判断依赖）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '面对面语音翻译 — 爱翻译 · AI翻译',
  description: '面对面语音翻译：一方说中文、一方说英文，自动识别并翻译，说一句译一句，适合跨语言交流场景。',
};

export default function VoicePage() {
  return <VoicePageClient />;
}
