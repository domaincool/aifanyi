import type { Metadata } from 'next';
import AdminCreditsClient from './AdminCreditsClient';

export const metadata: Metadata = {
  title: '额度管理（管理员） | 爱翻译',
  robots: { index: false, follow: false },
};

export default function AdminCreditsPage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>额度管理（管理员）</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 24px' }}>用户额度查询 / 调整 / 对账报告</p>
      <AdminCreditsClient />
    </div>
  );
}
