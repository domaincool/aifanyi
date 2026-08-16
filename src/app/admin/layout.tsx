/**
 * /admin 布局：服务端 requireAdmin 守卫（非 admin → 404，避免暴露后台存在）+ 侧边导航
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/credit/admin-auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const nav = [
    { href: '/admin', label: '数据看板' },
    { href: '/admin/memes', label: '词条管理' },
    { href: '/admin/blindtests', label: '盲测管理' },
    { href: '/admin/audit', label: '审计日志' },
    { href: '/admin/credits', label: '积分管理' },
    { href: '/admin/payments', label: '退款补单' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>爱翻译 · 管理后台</span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{admin.email}</span>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} style={{ fontSize: 13.5, color: 'var(--accent2, var(--accent))', textDecoration: 'none', borderBottom: '1px solid transparent', paddingBottom: 2 }}>
              {n.label}
            </Link>
          ))}
          <Link href="/" style={{ fontSize: 13.5, color: 'var(--muted)', textDecoration: 'none' }}>← 回前台</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
