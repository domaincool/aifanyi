'use client';

import { useState, useEffect } from 'react';
import UsageBar from '@/components/UsageBar';

interface UserInfo { id: string; email?: string; nickname?: string; avatar?: string; }
interface JobItem { taskId: string; fileName: string; status: string; pageCount: number; sourceLang: string; targetLang: string; createdAt: string; }

export default function AccountClient({ user }: { user: UserInfo }) {
  const [tab, setTab] = useState('overview');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t) setTab(t);
    const loginParam = params.get('login');
    if (loginParam === 'success') {
      fetch('/api/account/migrate', { method: 'POST' }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (tab === 'overview' || tab === 'history') {
      fetch('/api/account/history').then(r => r.json()).then(d => { if (d.jobs) setJobs(d.jobs); setLoading(false); }).catch(() => setLoading(false));
    } else if (tab === 'usage') {
      fetch('/api/account/usage').then(r => r.json()).then(d => { setUsage(d); setLoading(false); }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [tab]);

  const handleDelete = async (taskId: string) => {
    if (!confirm('确定要删除这个翻译吗？')) return;
    await fetch(`/api/account/history/${taskId}`, { method: 'DELETE' });
    setJobs(jobs.filter(j => j.taskId !== taskId));
  };

  const statusLabel: Record<string, string> = { queued: '排队中', processing: '翻译中', completed: '已完成', failed: '失败' };

  if (loading) return <div className="account-page"><div className="loading">加载中...</div></div>;

  return (
    <div className="account-page">
      <div className="account-header">
        <div className="account-user-info">
          <span className="user-avatar-lg">{user.nickname?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
          <div>
            <h1>{user.nickname || user.email?.split('@')[0]}</h1>
            <span className="account-email">{user.email}</span>
          </div>
        </div>
        <nav className="account-tabs">
          <button className={`account-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>概览</button>
          <button className={`account-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>我的翻译</button>
          <button className={`account-tab ${tab === 'usage' ? 'active' : ''}`} onClick={() => setTab('usage')}>使用额度</button>
          <button className={`account-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>账户设置</button>
        </nav>
      </div>

      {tab === 'overview' && (
        <div className="account-section">
          <h2>最近翻译</h2>
          {jobs.length === 0 ? (
            <div className="empty-state">还没有翻译记录。上传一个 PDF 开始吧！</div>
          ) : (
            <div className="job-list-compact">
              {jobs.slice(0, 5).map(j => (
                <div key={j.taskId} className="job-item-compact">
                  <span className="job-name">{j.fileName}</span>
                  <span className="job-meta">{j.pageCount}页 · {j.sourceLang}→{j.targetLang}</span>
                  <span className={`job-status job-status-${j.status}`}>{statusLabel[j.status] || j.status}</span>
                </div>
              ))}
              {jobs.length > 5 && <a href="/account?tab=history" className="view-all">查看全部 ({jobs.length})</a>}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="account-section">
          <h2>我的翻译</h2>
          {jobs.length === 0 ? (
            <div className="empty-state">还没有翻译记录。</div>
          ) : (
            <div className="job-list">
              {jobs.map(j => (
                <div key={j.taskId} className="job-item">
                  <div className="job-info">
                    <strong>{j.fileName}</strong>
                    <span className="job-meta">{j.pageCount}页 · {j.sourceLang}→{j.targetLang} · {new Date(j.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <span className={`job-status job-status-${j.status}`}>{statusLabel[j.status] || j.status}</span>
                  <div className="job-actions">
                    {j.status === 'completed' && <a href={`/pdf/${j.taskId}`} className="btn-sm">继续阅读</a>}
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(j.taskId)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'usage' && usage && (
        <div className="account-section">
          <h2>使用额度</h2>
          <UsageBar used={usage.today.used} limit={usage.today.limit} label="今日已用文件" />
          <p className="usage-reset">{usage.today.resetAt}</p>
          {usage.history?.length > 0 && (
            <div className="usage-history">
              <h3>最近使用</h3>
              {usage.history.slice(0, 10).map((h: any, i: number) => (
                <div key={i} className="usage-item">
                  <span>{new Date(h.createdAt).toLocaleString('zh-CN')}</span>
                  <span>{h.type} · {h.amount} {h.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="account-section">
          <h2>账户设置</h2>
          <div className="settings-group">
            <label>昵称</label>
            <input type="text" defaultValue={user.nickname || ''} placeholder="设置昵称" className="settings-input"
              onBlur={async (e) => { if (e.target.value) { await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: e.target.value }) }); } }} />
          </div>
          <div className="settings-group">
            <label>邮箱</label>
            <span className="settings-value">{user.email}</span>
          </div>
          <hr className="settings-divider" />
          <div className="settings-danger">
            <h3>注销账户</h3>
            <p>注销后，你的账户、翻译历史和相关数据将被删除，此操作无法撤销。</p>
            <button className="btn-danger" onClick={async () => {
              if (!confirm('确定要注销账户吗？此操作无法撤销！')) return;
              if (!confirm('再次确认：所有翻译记录、文件都将被删除。')) return;
              await fetch('/api/account/delete', { method: 'DELETE' });
              window.location.href = '/';
            }}>注销账户</button>
          </div>
        </div>
      )}
    </div>
  );
}