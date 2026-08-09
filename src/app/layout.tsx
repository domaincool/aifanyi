import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: '爱翻译 aifanyi — AI 翻译工作台 · 盲测擂台 · 梗翻译',
  description: '爱翻译（aifanyi.com）—— AI 翻译工作台、译文盲测擂台、网络用语翻译。跨境电商 Listing 本地化、梗翻译、多模型对比，让翻译被爱。',
  keywords: ['AI翻译', '跨境电商翻译', 'Listing本地化', '梗翻译', 'YYDS英文', '机翻对比'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <a href="/" className="logo">爱翻译<span> · aifanyi.com</span></a>
          <nav>
            <a href="/blindtest">盲测擂台</a>
            <a href="/meme">梗翻译</a>
            <a href="/#workbench">工作台</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>爱翻译 · aifanyi.com · AI 翻译，认真翻译 © 2026</p>
        </footer>
        {/* 百度统计：页面交互后加载，不阻塞首屏 */}
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