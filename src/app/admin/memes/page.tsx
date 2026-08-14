import type { Metadata } from 'next';
import MemesAdminClient from './MemesAdminClient';

export const metadata: Metadata = {
  title: '词条管理（管理员） | 爱翻译',
  robots: { index: false, follow: false },
};

export default function AdminMemesPage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>词条管理</h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13.5 }}>
          运营 Primary 通道：搜索 / 新建 / 批量导入（dryRun 预览） / 上下架。保存即生效，sitemap 自动收录。
        </p>
      </div>
      <MemesAdminClient />
    </div>
  );
}
