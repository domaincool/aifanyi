import type { Metadata } from 'next';
import BlindtestsAdminClient from './BlindtestsAdminClient';

export const metadata: Metadata = {
  title: '盲测题管理（管理员） | 爱翻译',
  robots: { index: false, follow: false },
};

export default function AdminBlindtestsPage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>盲测题管理</h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13.5 }}>
          新建题目将自动调用 DeepSeek / GLM / Google 三模型生成匿名译文（约 10-30 秒）。
        </p>
      </div>
      <BlindtestsAdminClient />
    </div>
  );
}
