import type { Metadata } from 'next';
import AuditClient from './AuditClient';

export const metadata: Metadata = {
  title: '审计日志（管理员） | 爱翻译',
  robots: { index: false, follow: false },
};

export default function AdminAuditPage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>审计日志</h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13.5 }}>所有管理写操作留痕：导入 / 创建 / 编辑 / 上下架 / 删除</p>
      </div>
      <AuditClient />
    </div>
  );
}
