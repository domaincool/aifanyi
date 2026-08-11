import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import AccountClient from './AccountClient';

export const metadata = { title: '我的翻译 - 爱翻译 AI翻译', robots: 'noindex' };

export default async function AccountPage() {
  const token = await getSessionCookie();
  if (!token) redirect('/?login_required=1');
  const user = await validateSession(token);
  if (!user) redirect('/?login_required=1');

  return <AccountClient user={{ id: user.userId, email: user.email, nickname: user.nickname, avatar: user.avatar }} />;
}