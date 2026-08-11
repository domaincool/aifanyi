import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getGuestCookie } from '@/lib/auth/cookie';
import { migrateGuestTasks } from '@/lib/auth/migrate';

export const runtime = 'nodejs';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const guestId = await getGuestCookie();
  if (!guestId) return NextResponse.json({ ok: true, migrated: 0, message: '无游客任务需要迁移。' });

  const count = await migrateGuestTasks(guestId, auth.user.userId);
  return NextResponse.json({ ok: true, migrated: count, message: `已迁移 ${count} 个翻译任务到您的账户。` });
}