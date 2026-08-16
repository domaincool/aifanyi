'use client';
import { useState, useCallback } from 'react';

interface UserInfo { id: string; email: string | null; nickname: string | null; createdAt: string; }
interface BalanceInfo { available: number; reserved: number; total: number; }
interface LedgerRow { id: string; type: string; amount: number; jobId: string | null; description: string | null; createdAt: string; }
interface OrderRow {
  id: string; planCode: string; planName: string; priceCents: number;
  purchasedCredits: number; bonusCredits: number; status: string; provider: string | null;
  providerOrderId: string | null; createdAt: string; paidAt: string | null; grantedAt: string | null; expiresAt: string | null;
}
interface UserResult { user: UserInfo; balance: BalanceInfo; ledger: LedgerRow[]; orders: OrderRow[]; }

const STATUS_COLOR: Record<string, string> = {
  pending: 'rgba(255,193,7,.15)',
  paid: 'rgba(13,110,253,.12)',
  granted: 'rgba(25,135,84,.14)',
  expired: 'rgba(108,117,125,.12)',
  cancelled: 'rgba(220,53,69,.12)',
};

const inputStyle: React.CSSProperties = { padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: 12.5 };
const tdStyle: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: 12.5 };

export default function AdminPaymentClient() {
  const [userQuery, setUserQuery] = useState('');
  const [userResult, setUserResult] = useState<UserResult | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  const [refund, setRefund] = useState({ userId: '', email: '', amount: '', reason: '', jobId: '', orderId: '', confirmed: false });
  const [refunding, setRefunding] = useState(false);

  const [orderQuery, setOrderQuery] = useState('');
  const [orderResult, setOrderResult] = useState<OrderRow | null>(null);
  const [comp, setComp] = useState({ providerOrderId: '', note: '', confirmed: false });
  const [completing, setCompleting] = useState(false);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadUser = useCallback(async (q: string) => {
    if (!q.trim()) { setError('请输入用户 ID 或邮箱'); return; }
    setUserLoading(true); setError(''); setNotice('');
    try {
      const key = q.includes('@') ? 'email' : 'userId';
      const res = await fetch(`/api/admin/payments?${key}=${encodeURIComponent(q.trim())}`);
      const d = await res.json();
      if (!res.ok) { setError(d.error || '查询失败'); setUserResult(null); return; }
      setUserResult(d);
      setRefund((r) => ({ ...r, userId: key === 'userId' ? d.user.id : '', email: key === 'email' ? (d.user.email || '') : '' }));
    } catch { setError('查询失败'); } finally { setUserLoading(false); }
  }, []);

  const loadOrder = useCallback(async (q: string) => {
    if (!q.trim()) { setError('请输入订单 ID 或渠道订单号'); return; }
    setError(''); setNotice('');
    try {
      const res = await fetch(`/api/admin/payments?q=${encodeURIComponent(q.trim())}`);
      const d = await res.json();
      if (!res.ok) { setError(d.error || '订单不存在'); setOrderResult(null); return; }
      setOrderResult(d.order);
      setComp((c) => ({ ...c, providerOrderId: d.order.providerOrderId || '' }));
    } catch { setError('查询失败'); }
  }, []);

  const doRefund = async () => {
    setNotice(''); setError('');
    const amount = parseInt(refund.amount, 10);
    if (!refund.userId && !refund.email) { setError('请先查询用户（用于确认余额与流水）'); return; }
    if (!Number.isFinite(amount) || amount < 1) { setError('退款积分必须是正整数'); return; }
    if (!refund.reason.trim() || refund.reason.trim().length < 2) { setError('请填写退款原因（至少 2 字）'); return; }
    if (!refund.confirmed) { setError('请先勾选「已确认退款金额与原因」'); return; }
    setRefunding(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refund',
          userId: refund.userId || undefined,
          email: refund.email || undefined,
          amount,
          reason: refund.reason.trim(),
          jobId: refund.jobId.trim() || undefined,
          orderId: refund.orderId.trim() || undefined,
          confirmed: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || '退款失败'); return; }
      setNotice(`已退款 ${d.refunded} 积分（当前可用 ${d.balance.available}）`);
      setRefund((r) => ({ ...r, amount: '', reason: '', jobId: '', orderId: '', confirmed: false }));
      if (userResult) loadUser(userResult.user.email || userResult.user.id);
    } catch { setError('退款失败'); } finally { setRefunding(false); }
  };

  const doComplete = async () => {
    setNotice(''); setError('');
    if (!orderResult) { setError('请先查询订单'); return; }
    if (!comp.providerOrderId.trim()) { setError('请填写渠道订单号'); return; }
    if (!comp.note.trim() || comp.note.trim().length < 2) { setError('请填写补单说明（至少 2 字）'); return; }
    if (!comp.confirmed) { setError('请先勾选「已核实渠道收款」'); return; }
    setCompleting(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_order',
          orderId: orderResult.id,
          providerOrderId: comp.providerOrderId.trim(),
          note: comp.note.trim(),
          confirmed: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || '补单失败'); return; }
      setNotice(d.already
        ? '该订单此前已到账，重复提交已幂等跳过（不会重复发放）'
        : `补单成功：本金 ${d.granted?.purchased ?? 0} + 赠送 ${d.granted?.bonus ?? 0} 积分已到账`);
      loadOrder(orderResult.id);
    } catch { setError('补单失败'); } finally { setCompleting(false); }
  };

  const sectionStyle: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
  const h2Style: React.CSSProperties = { fontSize: 16, margin: '0 0 12px' };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {error && <p style={{ color: 'var(--danger)', background: 'rgba(220,53,69,.08)', padding: 10, borderRadius: 8 }}>{error}</p>}
      {notice && <p style={{ color: 'var(--accent)', background: 'rgba(25,135,84,.08)', padding: 10, borderRadius: 8 }}>{notice}</p>}

      {/* 用户查询 */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>用户查询（余额 / 流水 / 充值订单）</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <input placeholder="用户 ID 或邮箱（查询后自动带入退款表单）" value={userQuery}
            onChange={e => setUserQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadUser(userQuery); }}
            style={inputStyle} />
          <button className="btn-primary" style={{ padding: '8px 16px' }} onClick={() => loadUser(userQuery)} disabled={userLoading}>
            {userLoading ? '查询中…' : '查询'}
          </button>
        </div>

        {userResult && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13.5 }}>
              <b>{userResult.user.nickname || '(未设置昵称)'}</b> · {userResult.user.email || '(无邮箱)'}
              <span style={{ marginLeft: 12 }}>可用 <b style={{ color: 'var(--accent)' }}>{userResult.balance.available}</b></span>
              <span style={{ marginLeft: 10, color: 'var(--muted)' }}>预留 {userResult.balance.reserved} · 总额 {userResult.balance.total}</span>
              <button style={{ marginLeft: 14, fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                onClick={() => { setRefund({ ...refund, amount: String(userResult.balance.available), confirmed: false }); }}>全额退可用余额</button>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12.5 }}>
              <div>
                <h3 style={{ fontSize: 13.5, margin: '8px 0 6px' }}>最近流水（{userResult.ledger.length}）</h3>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {userResult.ledger.map((l) => (
                    <div key={l.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{l.type} · {l.description || ''}{l.jobId ? `（${l.jobId}）` : ''}</span>
                      <span style={{ color: l.amount >= 0 ? 'var(--accent)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                        {l.amount >= 0 ? '+' : ''}{l.amount} · {new Date(l.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                  {userResult.ledger.length === 0 && <p style={{ color: 'var(--muted)' }}>无流水</p>}
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: 13.5, margin: '8px 0 6px' }}>充值订单（{userResult.orders.length}）</h3>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {userResult.orders.map((o) => (
                    <div key={o.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span>
                        <span style={{ background: STATUS_COLOR[o.status] || 'transparent', borderRadius: 4, padding: '1px 6px', fontSize: 11.5 }}>{o.status}</span>{' '}
                        {o.planName}（本金 {o.purchasedCredits} + 赠 {o.bonusCredits}）
                      </span>
                      <button style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                        onClick={() => { setOrderQuery(o.id); loadOrder(o.id); }}>补单</button>
                    </div>
                  ))}
                  {userResult.orders.length === 0 && <p style={{ color: 'var(--muted)' }}>无充值订单</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 退款 */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>积分退款（给用户退还积分）</h2>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
          用于服务问题补偿 / 已扣费未完成任务退款。写入 REFUND 流水；填写关联任务号或订单号可标记对应任务为已退款（creditState=refunded）。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <input placeholder="用户 ID（查询后自动带入）" value={refund.userId} onChange={e => setRefund({ ...refund, userId: e.target.value })} style={inputStyle} />
          <input placeholder="用户邮箱（二选一）" value={refund.email} onChange={e => setRefund({ ...refund, email: e.target.value })} style={inputStyle} />
          <input placeholder="退款积分量（正整数）" value={refund.amount} onChange={e => setRefund({ ...refund, amount: e.target.value })} style={inputStyle} />
          <input placeholder="关联任务号 jobId（选填）" value={refund.jobId} onChange={e => setRefund({ ...refund, jobId: e.target.value })} style={inputStyle} />
          <input placeholder="关联订单号（选填）" value={refund.orderId} onChange={e => setRefund({ ...refund, orderId: e.target.value })} style={inputStyle} />
          <input placeholder="退款原因（必填，至少 2 字）" value={refund.reason} onChange={e => setRefund({ ...refund, reason: e.target.value })} style={inputStyle} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0', fontSize: 12.5 }}>
          <input type="checkbox" checked={refund.confirmed} onChange={e => setRefund({ ...refund, confirmed: e.target.checked })} />
          已确认退款金额与原因（退款为真实补偿，请勿用于无依据发放积分）
        </label>
        <button className="btn-primary" style={{ padding: '8px 16px' }} onClick={doRefund} disabled={refunding}>
          {refunding ? '退款中…' : '确认退款'}
        </button>
      </section>

      {/* 补单 */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>充值订单补单（仅限真实已收款未到账）</h2>
        <p style={{ fontSize: 12.5, color: 'var(--danger)', background: 'rgba(220,53,69,.06)', padding: 10, borderRadius: 8, margin: '0 0 12px' }}>
          ⚠️ 补单 ≠ 伪造支付：仅限已在支付渠道后台核实「真实收到款项」但积分未到账的订单。
          系统会严格校验我方订单记录的渠道订单号与您填写的完全一致后才放行；未记录渠道订单号的订单无法补单。
          已取消 / 已退款的订单永不到账。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <input placeholder="我方订单 ID 或渠道订单号" value={orderQuery}
            onChange={e => setOrderQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadOrder(orderQuery); }}
            style={inputStyle} />
          <button className="btn-primary" style={{ padding: '8px 16px' }} onClick={() => loadOrder(orderQuery)}>查询订单</button>
        </div>

        {orderResult && (
          <div style={{ marginTop: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <tbody>
                <tr><td style={tdStyle}>订单号</td><td style={tdStyle}>{orderResult.id}</td></tr>
                <tr><td style={tdStyle}>套餐 / 状态</td><td style={tdStyle}>{orderResult.planName} · <span style={{ background: STATUS_COLOR[orderResult.status] || 'transparent', borderRadius: 4, padding: '1px 6px' }}>{orderResult.status}</span></td></tr>
                <tr><td style={tdStyle}>金额 / 积分</td><td style={tdStyle}>¥{(orderResult.priceCents / 100).toFixed(2)} · 本金 {orderResult.purchasedCredits} + 赠送 {orderResult.bonusCredits}</td></tr>
                <tr><td style={tdStyle}>渠道 / 渠道订单号</td><td style={tdStyle}>{orderResult.provider || '-'} · {orderResult.providerOrderId || '（未记录，无法补单）'}</td></tr>
                <tr><td style={tdStyle}>创建 / 支付 / 到账</td><td style={tdStyle}>
                  {new Date(orderResult.createdAt).toLocaleString('zh-CN')} / {orderResult.paidAt ? new Date(orderResult.paidAt).toLocaleString('zh-CN') : '-'} / {orderResult.grantedAt ? new Date(orderResult.grantedAt).toLocaleString('zh-CN') : '-'}
                </td></tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <input placeholder="渠道订单号（与渠道后台收款单号一致，必填）" value={comp.providerOrderId}
                onChange={e => setComp({ ...comp, providerOrderId: e.target.value })} style={inputStyle} />
              <input placeholder="补单说明（必填，至少 2 字）" value={comp.note}
                onChange={e => setComp({ ...comp, note: e.target.value })} style={inputStyle} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0', fontSize: 12.5 }}>
              <input type="checkbox" checked={comp.confirmed} onChange={e => setComp({ ...comp, confirmed: e.target.checked })} />
              已核实：已在渠道后台确认该订单收款成功，渠道订单号与上面填写一致
            </label>
            <button className="btn-primary" style={{ padding: '8px 16px' }} onClick={doComplete} disabled={completing}>
              {completing ? '补单中…' : '确认补单（到账本金 + 赠送）'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
