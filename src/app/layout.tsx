import type { Metadata } from 'next';
import Script from 'next/script';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import ClientLayout from '@/components/ClientLayout';
import './globals.css';

export const metadata: Metadata = {
  title: '爱翻译 - 免费在线翻译,英文翻译成中文,智能翻译,实时翻译',
  description: '爱翻译提供免费在线翻译服务：英文翻译成中文、中文翻译成英文，支持实时智能翻译，翻译准确自然。跨境电商文案、外文文档、网络用语都能翻，多模型对比选更佳译文。免费使用，无需付费。',
  keywords: ['在线翻译', '英文翻译成中文', '中文翻译成英文', '智能翻译', '实时翻译', '免费翻译', '爱翻译'],
  openGraph: {
    title: '爱翻译 - 在线翻译,英文翻译成中文,智能翻译,实时翻译',
    description: '爱翻译提供免费在线翻译服务：英文翻译成中文、中文翻译成英文，支持实时智能翻译，翻译准确自然。跨境电商文案、外文文档、网络用语都能翻，多模型对比选更佳译文。',
    url: 'https://aifanyi.com',
    siteName: '爱翻译',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: 'https://aifanyi.com/og-image.png', width: 1200, height: 630, alt: '爱翻译 - 在线翻译,智能翻译,实时翻译' }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 服务端读取登录态
  let user: { id: string; email?: string; nickname?: string; avatar?: string } | null = null;
  try {
    const token = await getSessionCookie();
    if (token) {
      const u = await validateSession(token);
      if (u) user = { id: u.userId, email: u.email, nickname: u.nickname, avatar: u.avatar };
    }
  } catch { /* 忽略 */ }

  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('aifanyi_theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();` }} />
      </head>
      <body>
        <ClientLayout serverUser={user}>
          {children}
        </ClientLayout>
        <Script id="baidu-analytics" strategy="afterInteractive">
          {`var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?aa2fa4ed30a027cf6f63ee44aef428eb";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`}
        </Script>
      </body>
    </html>
  );
}