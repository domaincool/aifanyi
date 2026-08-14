import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: '数据看板（管理员） | 爱翻译',
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>数据看板</h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13.5 }}>运营核心指标 · 成本 · 近 7 天调用趋势 · 内容状态分布</p>
      </div>
      <DashboardClient />
    </div>
  );
}
