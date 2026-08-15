'use client';
/**
 * 积分页（V2.2：用户侧统一「积分」命名 + 充值入口）
 * ✅ 用户只见：积分余额 / 本月使用 / 积分来源 / 积分充值
 * ❌ 不出现：钱包 / 资产 / 账本 / Credit 等技术术语
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
interface Plan {
  code: string;
  name: string;
  priceCents: number;
  totalCredits: number;
  bonusCredits: number;
  badge: string | null;
  description: string | null;
}

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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      fetch('/api/credit/balance').then(r => r.json()),
      fetch('/api/credit/history').then(r => r.json()),
      fetch('/api/credits/plans').then(r => r.json()).catch(() => ({ plans: [] })),
    ]).then(([b, h, p]) => {
      setData(b);
      if (h.loggedIn) setHistory(h.items || []);
      if (p && Array.isArray(p.plans)) setPlans(p.plans);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中…</p>;

  // ── 未登录态 ──
  if (data && !data.loggedIn) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎁</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>登录即送 {data.signupBonus ?? 500} 免费积分</h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.7 }}>
            新老用户登录后自动到账，30 天内有效。<br />
            翻译成功才扣积分，失败自动退回，用量透明可查。
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

  const buy = async (plan: Plan) => {
    setBuying(plan.code); setErr(null); setMsg(null);
    try {
      const r = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: plan.code }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErr(j.error || '下单失败，请重试。'); return; }
      // 模拟支付确认（真实支付接入后改为跳转支付）
      const c = await fetch('/api/credits/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: j.orderId }),
      });
      const cj = await c.json();
      if (!c.ok || !cj.ok) { setErr(cj.error || '支付确认失败，请重试。'); return; }
      setMsg(`✅ ${plan.name}已到账：+${cj.granted.purchased + cj.granted.bonus} 积分（含赠送 +${cj.granted.bonus}）`);
      load();
    } catch (e) {
      setErr('网络异常，请稍后重试。');
    } finally {
      setBuying(null);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 20 }}>
      {/* 顶部：可用积分 */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 14 }}>当前可用积分</p>
            <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{available}</div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <div>本月已用：{monthUsed}</div>
            {data?.expiringAt && <div>免费积分到期：{fmtDate(data.expiringAt)}</div>}
          </div>
        </div>
        {low && (
          <p style={{ margin: '16px 0 0', padding: '10px 14px', background: 'rgba(255,193,7,.12)', border: '1px solid rgba(255,193,7,.4)', borderRadius: 10, color: 'var(--text)', fontSize: 14 }}>
            ⚡ 剩余积分不多了（{available}/500）。积分不足时可以充值补充。
          </p>
        )}
      </div>

      {/* 积分充值（3 SKU） */}
      {plans.length > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>积分充值</h3>
          <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 13 }}>
            充值越多越划算：充得越多，赠送越多。购买的积分长期有效，赠送积分 30 天有效。
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {plans.map(p => (
              <div key={p.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {p.name}
                    {p.badge && <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 8px', borderRadius: 999, background: 'rgba(37,99,235,.12)', color: 'var(--accent)' }}>{p.badge}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    {p.description} · <b>{p.totalCredits}</b> 积分
                    {p.bonusCredits > 0 && <span style={{ color: 'var(--accent)' }}>（含赠送 +{p.bonusCredits}）</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>¥{(p.priceCents / 100).toFixed(1)}</span>
                  <button
                    onClick={() => buy(p)}
                    disabled={buying !== null}
                    className="btn-primary"
                    style={{ padding: '8px 18px', border: 'none', borderRadius: 10, cursor: buying ? 'wait' : 'pointer', fontSize: 14 }}
                  >
                    {buying === p.code ? '处理中…' : '购买'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {err && <p style={{ margin: '12px 0 0', color: 'var(--red, #dc2626)', fontSize: 13 }}>{err}</p>}
          {msg && <p style={{ margin: '12px 0 0', color: 'var(--green, #16a34a)', fontSize: 13 }}>{msg}</p>}
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 12 }}>
            * 当前为模拟支付（支付渠道接入中），确认后积分即刻到账。
          </p>
        </div>
      )}

      {/* 积分来源 */}
      {data?.grants && data.grants.length > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>积分来源</h3>
          {data.grants.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < data.grants!.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 14 }}>
              <span>{g.source}</span>
              <span style={{ color: 'var(--muted)' }}>
                剩余 {g.remaining}/{g.total}
                {g.expiresAt ? ` · ${fmtDate(g.expiresAt)}到期` : ' · 长期有效'}
              </span>
            </div>
          ))}
          <p style={{ margin: '14px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            积分不足时可在上方充值；翻译成功才扣积分，失败自动退回。
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
