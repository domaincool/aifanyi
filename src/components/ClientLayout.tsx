'use client';

import { useState, useEffect } from 'react';
import LoginModal from './LoginModal';
import UserMenu from './UserMenu';

interface UserInfo { id: string; email?: string; nickname?: string; avatar?: string; }

export default function ClientLayout({ children, serverUser }: { children: React.ReactNode; serverUser: UserInfo | null }) {
  const [user, setUser] = useState<UserInfo | null>(serverUser);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // 打开登录弹窗时记录当前页面（登录成功后回跳）
    const rememberNext = () => {
      try {
        document.cookie = `aifanyi_next=${encodeURIComponent(window.location.pathname + window.location.search)}; path=/; max-age=1800; samesite=lax`;
      } catch {}
    };
    const openLogin = () => { rememberNext(); setShowLogin(true); };
    const openFromHeader = () => { rememberNext(); setShowLogin(true); };
    window.addEventListener('open-login-modal', openLogin);
    return () => window.removeEventListener('open-login-modal', openLogin);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <>
      <header className="site-header">

        <a href="/" className="logo">爱翻译<span> · aifanyi.com</span></a>
        <nav>
          <a href="/voice">语音翻译</a>
          <a href="/tools">翻译工具</a>
          <a href="/blindtest">AI翻译擂台</a>
          <a href="/meme">网络用语翻译</a>
          <a href="/#workbench">跨境电商工作台</a>
        </nav>
        <button
          className="theme-toggle"
          aria-label="切换深浅色主题"
          title="切换深浅色主题"
          onClick={() => {
            const cur = document.documentElement.getAttribute('data-theme');
            const next = cur === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('aifanyi_theme', next); } catch {}
          }}
        >◐</button>
        <div className="header-auth">
          {user ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <button className="btn-login-header" onClick={() => {
            try { document.cookie = `aifanyi_next=${encodeURIComponent(window.location.pathname + window.location.search)}; path=/; max-age=1800; samesite=lax`; } catch {}
            setShowLogin(true);
          }}>登录 / 注册</button>
          )}
        </div>
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
              <a href="/voice">语音翻译</a>
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
              <a href="/privacy">隐私政策</a>
              <a href="/terms">服务条款</a>
              <a href="/updates">上线公告</a>
            </div>
          </nav>
        </div>
        <div className="footer-bottom">© 2026 爱翻译 · aifanyi.com</div>
      </footer>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}