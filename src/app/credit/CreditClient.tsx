'use client';
/**
 * 额度页（产品哲学：让用户放心使用 AI）
 * ✅ 用户只见：使用额度 / 剩余额度 / 本月使用 / 免费额度
 * ❌ 不出现：钱包 / 资产 / 账本 / 积分 / 余额（口径统一为「使用额度」）
 */
import { useEffect, useState } from 'react';

interface GrantInfo { source: string; total: number; remaining: number; expiresAt: string | null; }
interface BalanceData {
  loggedIn: boolean;
  available?: number;
  reserved?: number;
  monthUsed?: number;
  grants?: GrantInfo[];
  expiringAt?: string | null;
  signupBonus?: number;
  message?: string;
}
interface HistoryItem { id: string; type: string; amount: number; label: string; createdAt: string; }

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreditClient() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/credit/balance').then(r => r.json()),
      fetch('/api/credit/history').then(r => r.json()),
    ]).then(([b, h]) => {
      setData(b);
      if (h.loggedIn) setHistory(h.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中…</p>;

  // ── 未登录态 ──
  if (data && !data.loggedIn) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎁</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>登录即送 {data.signupBonus ?? 500} 免费额度</h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.7 }}>
            新老用户登录后自动到账，30 天内有效。<br />
            翻译成功才扣费，失败自动退回，用量透明可查。
          </p>
          <a href="/account" className="btn-primary" style={{ padding: '10px 28px', textDecoration: 'none', display: 'inline-block' }}>
            登录 / 注册
          </a>
        </div>
      </div>
    );
  }

  const available = data?.available ?? 0;
  const monthUsed = data?.monthUsed ?? 0;
  const low = available < 100; // 低余额轻提示（<20% 注册赠送 500）

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 20 }}>
      {/* 顶部：可用额度 */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 14 }}>当前可用额度</p>
            <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{available}</div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <div>本月已用：{monthUsed}</div>
            {data?.expiringAt && <div>免费额度到期：{fmtDate(data.expiringAt)}</div>}
          </div>
        </div>
        {low && (
          <p style={{ margin: '16px 0 0', padding: '10px 14px', background: 'rgba(255,193,7,.12)', border: '1px solid rgba(255,193,7,.4)', borderRadius: 10, color: 'var(--text)', fontSize: 14 }}>
            ⚡ 剩余额度不多了（{available}/500）。额度用完后按用量计费，用量透明可查。
          </p>
        )}
      </div>

      {/* 额度来源 */}
      {data?.grants && data.grants.length > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>免费额度来源</h3>
          {data.grants.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < data.grants!.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 14 }}>
              <span>{g.source}</span>
              <span style={{ color: 'var(--muted)' }}>
                剩余 {g.remaining}/{g.total}
                {g.expiresAt ? ` · ${fmtDate(g.expiresAt)}到期` : ''}
              </span>
            </div>
          ))}
          <p style={{ margin: '14px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            额度用完后仍可继续使用，按实际用量计费；每次翻译前都会提示预计消耗。
          </p>
        </div>
      )}

      {/* 使用明细 */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>最近使用记录</h3>
        {history.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>还没有使用记录，去首页试试翻译吧。</p>
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {history.map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                <span>{h.label}</span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {fmtDateTime(h.createdAt)}
                  {h.type === 'grant' || h.type === 'refund' || h.type === 'release'
                    ? <b style={{ color: 'var(--accent)', marginLeft: 8 }}>+{Math.abs(h.amount)}</b>
                    : h.type === 'consume'
                      ? <b style={{ marginLeft: 8 }}>-{Math.abs(h.amount)}</b>
                      : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
