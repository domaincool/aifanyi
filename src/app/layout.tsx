import type { Metadata } from 'next';
import Script from 'next/script';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import ClientLayout from '@/components/ClientLayout';
import './globals.css';

export const metadata: Metadata = {
  title: '爱翻译 aifanyi — AI 翻译工作台 · AI翻译擂台 · 网络用语翻译',
  description: '爱翻译 · AI翻译 —— AI 翻译工作台、AI翻译擂台、网络用语翻译。跨境电商 Listing 本地化、梗翻译、多模型对比。',
  keywords: ['AI翻译', '跨境电商翻译', 'Listing本地化', '网络用语翻译', 'YYDS英文', '机翻对比'],
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