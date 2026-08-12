/**
 * GET /api/credit/history
 * 用户友好明细：服务端把 Ledger 翻译成「PDF 翻译 -2」「注册赠送 +300」，不暴露内部术语
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';

export async function GET() {
  const auth = await getAuthUserId();
  if (!auth) return NextResponse.json({ loggedIn: false });

  const rows = await prisma.creditLedger.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, type: true, amount: true, description: true, createdAt: true },
  });

  const items = rows.map(r => {
    let label = r.description || '';
    if (r.type === 'grant') label = '注册赠送 +300';
    else if (r.type === 'consume') label = `翻译完成，使用 ${Math.abs(r.amount)}`;
    else if (r.type === 'release') label = '翻译未完成，额度已退回';
    else if (r.type === 'expire') label = '免费额度到期';
    else if (r.type === 'refund') label = '系统补偿';
    else if (r.type === 'admin_adjust') label = '管理员调整';
    return { id: r.id, type: r.type, amount: r.amount, label, createdAt: r.createdAt };
  });

  return NextResponse.json({ loggedIn: true, items });
}
