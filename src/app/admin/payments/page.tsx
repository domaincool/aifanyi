import type { Metadata } from 'next';
import AdminPaymentClient from './AdminPaymentClient';

export const metadata: Metadata = {
  title: '退款与补单（管理员） | 爱翻译',
  robots: { index: false, follow: false },
};

export default function AdminPaymentsPage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>退款与补单（管理员）</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 24px' }}>积分退款 / 充值订单补单（补单严格校验渠道订单号）</p>
      <AdminPaymentClient />
    </div>
  );
}
