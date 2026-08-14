import type { Metadata } from 'next';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import EcommerceWorkbench from '@/components/ecommerce/EcommerceWorkbench';

export const metadata: Metadata = {
  title: '跨境电商工作台 - 爱翻译',
  description: '爱翻译跨境电商工作台：AI 提取商品卖点、生成 Listing 文案、翻译商品图片与客户消息，助力跨境卖家高效出海。',
};

export default async function EcommercePage() {
  let user: { id: string; email?: string; nickname?: string; avatar?: string } | null = null;
  try {
    const token = await getSessionCookie();
    if (token) {
      const u = await validateSession(token);
      if (u) user = { id: u.userId, email: u.email, nickname: u.nickname, avatar: u.avatar };
    }
  } catch { /* 忽略 */ }

  return <EcommerceWorkbench serverUser={user} />;
}
