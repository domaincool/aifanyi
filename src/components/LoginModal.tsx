'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * 登录弹窗（设计专家方案 2026-08-12）
 * - Google 主路径全宽按钮 + 邮箱验证码折叠区（去 tab 二选一）
 * - 验证码分段 6 格：自动聚焦/跳格/回退/整段粘贴
 * - 发送后 60s 倒计时重发；错误内联展示；登录成功 ✓ 反馈后跳转
 * - Esc/遮罩关闭、body 滚动锁、焦点管理
 */
export default function LoginModal({ onClose }: { onClose: () => void }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

  // Esc 关闭 + 锁滚动 + 初始焦点
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // 倒计时（countdown>0 时启动一次 interval）
  const counting = countdown > 0;
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [counting]);

  const handleGoogle = () => { window.location.href = '/api/auth/google'; };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validEmail(email)) { setEmailError('请输入有效的邮箱地址'); return; }
    setEmailError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (data.ok) {
        setStep('code');
        setCountdown(60);
        setTimeout(() => inputRefs.current[0]?.focus(), 60);
      } else {
        setEmailError(data.message);
      }
    } catch {
      setEmailError('网络错误，请重试');
    } finally {
      setSending(false);
    }
  };

  const handleCodeChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '');
    const next = [...code];
    if (digit.length === 6) {
      // 一次粘贴 6 位
      setCode(digit.split('').concat(Array(6).fill('')).slice(0, 6));
      inputRefs.current[5]?.focus();
      setCodeError('');
      return;
    }
    next[i] = digit.slice(-1);
    setCode(next);
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
    setCodeError('');
  };

  const handleCodeKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handleCodePaste = (i: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (text.length) {
      e.preventDefault();
      const filled = text.slice(0, 6).split('');
      setCode(filled.concat(Array(6).fill('')).slice(0, 6));
      inputRefs.current[Math.min(text.length - 1, 5)]?.focus();
      setCodeError('');
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const full = code.join('');
    if (full.length !== 6) { setCodeError('请输入 6 位验证码'); return; }
    setCodeError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code: full }) });
      const data = await res.json();
      if (data.ok) {
        setStatus('success');
        let dest = '/account?login=success';
        try {
          const m = document.cookie.match(/(?:^|;\\s*)aifanyi_next=([^;]*)/);
          if (m && m[1]) { dest = decodeURIComponent(m[1]); document.cookie = 'aifanyi_next=; path=/; max-age=0'; }
        } catch {}
        setTimeout(() => { window.location.href = dest; }, 600);
      } else {
        setCodeError(data.message);
      }
    } catch {
      setCodeError('网络错误，请重试');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" role="dialog" aria-modal="true" aria-label="登录或注册爱翻译" onClick={e => e.stopPropagation()}>
        <button ref={closeBtnRef} className="login-close" onClick={onClose} aria-label="关闭">×</button>

        {status === 'success' ? (
          <div className="login-success">
            <div className="login-success-icon">✓</div>
            <p>登录成功！正在进入账户中心…</p>
          </div>
        ) : (
          <>
            <h2>登录 / 注册 爱翻译</h2>
            <p className="login-subtitle">新用户无需注册——用 Google 或邮箱验证码登录，有账号直接进，没账号自动创建</p>

            <button className="btn-google btn-google-block" onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              继续使用 Google
            </button>

            <div className="login-divider"><span>或</span></div>

            {!emailOpen ? (
              <button className="login-email-toggle" onClick={() => setEmailOpen(true)}>
                使用邮箱验证码（新用户自动注册）
              </button>
            ) : (
              <div className="login-email-section">
                {step === 'input' ? (
                  <form onSubmit={handleSend} noValidate>
                    <label className="login-label" htmlFor="login-email">邮箱地址</label>
                    <input
                      id="login-email"
                      type="email"
                      className={`login-input ${emailError ? 'has-error' : ''}`}
                      placeholder="name@example.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                      onBlur={() => { if (email && !validEmail(email)) setEmailError('请输入有效的邮箱地址'); }}
                      aria-invalid={!!emailError}
                    />
                    {emailError && <p className="login-error" role="alert">{emailError}</p>}
                    <button type="submit" className="login-btn" disabled={sending}>
                      {sending ? '发送中…' : '发送验证码'}
                    </button>
                    <button type="button" className="login-link-btn" onClick={() => setEmailOpen(false)}>← 返回</button>
                  </form>
                ) : (
                  <form onSubmit={handleVerify} noValidate>
                    <p className="login-code-sent">验证码已发送到 <strong>{email}</strong>，5 分钟内有效</p>
                    <div className="code-inputs" role="group" aria-label="验证码">
                      {code.map((d, i) => (
                        <input
                          key={i}
                          ref={el => { inputRefs.current[i] = el; }}
                          className={`code-input ${codeError ? 'has-error' : ''}`}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          value={d}
                          onChange={e => handleCodeChange(i, e.target.value)}
                          onKeyDown={e => handleCodeKey(i, e)}
                          onPaste={e => handleCodePaste(i, e)}
                          aria-label={`验证码第 ${i + 1} 位`}
                        />
                      ))}
                    </div>
                    {codeError && <p className="login-error" role="alert">{codeError}</p>}
                    <button type="submit" className="login-btn" disabled={sending}>
                      {sending ? '验证中…' : '登录'}
                    </button>
                    <div className="login-code-actions">
                      <button type="button" className="login-link-btn" disabled={sending || counting} onClick={() => handleSend()}>
                        {counting ? `${countdown}s 后重发` : '重新发送验证码'}
                      </button>
                      <button type="button" className="login-link-btn" onClick={() => { setStep('input'); setCode(['', '', '', '', '', '']); setCodeError(''); }}>
                        ← 换个邮箱
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="login-benefits">
              <span>✓ 翻译记录跨设备同步</span>
              <span>✓ 更多使用额度</span>
              <span>✓ 擂台参赛与积分</span>
            </div>

            <p className="login-footer-text">
              继续即代表你已阅读并同意 <a href="/terms" target="_blank" rel="noopener">《服务条款》</a> 与 <a href="/privacy" target="_blank" rel="noopener">《隐私政策》</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
