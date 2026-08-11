'use client';

import { useState, useEffect } from 'react';

export default function GuestPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('login_prompt_dismissed');
    if (!dismissed) setShow(true);
  }, []);

  const dismiss = () => { sessionStorage.setItem('login_prompt_dismissed', '1'); setShow(false); };
  const handleLogin = () => { dismiss(); window.dispatchEvent(new CustomEvent('open-login-modal')); };

  if (!show) return null;
  return (
    <div className="guest-prompt">
      <div className="guest-prompt-body">
        <strong>登录后译文长期保存，随时回来查看</strong>
        <div className="guest-prompt-actions">
          <button className="btn-google-sm" onClick={handleLogin}>用 Google 登录</button>
          <button className="btn-email-sm" onClick={handleLogin}>用邮箱登录</button>
        </div>
        <span className="guest-prompt-muted">未登录文件 24 小时后自动删除 · <button onClick={dismiss} className="link-btn">暂不保存 ✕</button></span>
      </div>
    </div>
  );
}