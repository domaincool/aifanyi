import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: '爱翻译 aifanyi — AI 翻译工作台 · AI翻译擂台 · 网络用语翻译',
  description: '爱翻译 · AI翻译 —— AI 翻译工作台、AI翻译擂台、网络用语翻译。跨境电商 Listing 本地化、梗翻译、多模型对比。',
  keywords: ['AI翻译', '跨境电商翻译', 'Listing本地化', '网络用语翻译', 'YYDS英文', '机翻对比'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <a href="/" className="logo">爱翻译<span> · aifanyi.com</span></a>
          <nav>
            <a href="/tools">翻译工具</a>
            <a href="/blindtest">AI翻译擂台</a>
            <a href="/meme">网络用语翻译</a>
            <a href="/#workbench">跨境电商工作台</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-brand-name">爱翻译 <span>· aifanyi.com</span></div>
              <div className="footer-brand-slogan">懂语境的 AI 翻译与本地化工具</div>
            </div>
            <nav className="footer-cols">
              <div className="footer-col">
                <h4>产品</h4>
                <a href="/">AI翻译</a>
                <a href="/tools#pdf">PDF翻译</a>
                <a href="/tools#image">图片翻译</a>
                <a href="/tools#subtitle">字幕翻译</a>
                <a href="/tools#web">网页翻译</a>
                <a href="/">AI润色</a>
              </div>
              <div className="footer-col">
                <h4>解决方案</h4>
                <a href="/#workbench">跨境电商</a>
                <a href="#">内容创作</a>
                <a href="#">企业翻译</a>
                <a href="#">个人用户</a>
              </div>
              <div className="footer-col">
                <h4>资源</h4>
                <a href="/meme">翻译术语</a>
                <a href="#">AI翻译指南</a>
                <a href="#">帮助中心</a>
                <a href="#">API</a>
              </div>
              <div className="footer-col">
                <h4>关于</h4>
                <a href="#">关于我们</a>
                <a href="#">联系我们</a>
                <a href="#">隐私政策</a>
                <a href="#">服务条款</a>
              </div>
            </nav>
          </div>
          <div className="footer-bottom">© 2026 爱翻译 · aifanyi.com</div>
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