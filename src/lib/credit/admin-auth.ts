/**
 * Admin 鉴权：ADMIN_EMAILS 环境变量（逗号分隔邮箱），登录用户邮箱命中即 admin
 */
import { prisma } from '@/lib/db';
import { getAuthUserId } from './sync-settle';

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireAdmin(): Promise<{ userId: string; email: string } | null> {
  const auth = await getAuthUserId();
  if (!auth) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  if (!user || !isAdminEmail(user.email)) return null;
  return { userId: auth.userId, email: user.email! };
}
