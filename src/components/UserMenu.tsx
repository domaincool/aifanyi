'use client';

import { useState, useRef, useEffect } from 'react';

interface UserInfo { id: string; email?: string; nickname?: string; avatar?: string; }

export default function UserMenu({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);

  const initial = (user.nickname || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-trigger" onClick={() => setOpen(!open)}>
        {user.avatar ? <img src={user.avatar} alt="" className="user-avatar" /> : <span className="user-avatar-placeholder">{initial}</span>}
        <span className="user-name">{user.nickname || user.email?.split('@')[0]}</span>
        <span className="user-arrow">▼</span>
      </button>
      {open && (
        <div className="user-dropdown">
          <a href="/account" className="dropdown-item">我的翻译</a>
          <a href="/credit" className="dropdown-item">我的积分</a>
          <a href="/account?tab=settings" className="dropdown-item">账户设置</a>
          <hr className="dropdown-divider" />
          <button className="dropdown-item logout" onClick={onLogout}>退出登录</button>
        </div>
      )}
    </div>
  );
}