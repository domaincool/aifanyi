import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession, revokeAllUserSessions } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * PATCH /api/account
 * 更新账户资料（昵称）
 */
export async function PATCH(req: NextRequest) {
  const token = await getSessionCookie();
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const user = await validateSession(token);
  if (!user) return NextResponse.json({ error: '会话已过期' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.nickname === 'string' && body.nickname.trim().length > 0 && body.nickname.trim().length <= 30) {
    data.nickname = body.nickname.trim();
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: user.userId }, data, select: { nickname: true, email: true, avatar: true } });
  return NextResponse.json({ ok: true, user: updated });
}

/**
 * DELETE /api/account
 * 删除账户（软删除，审计保留）：
 * 1. User.status='deleted'（validateSession 检查 status，会话立即失效）
 * 2. email 匿名化（防重新注册冲突）
 * 3. Sessions revoke + 本地 cookie 清理
 * 4. CreditGrant 额度归零 / CreditAccount 余额清零（写 Ledger「账户注销」审计行）
 * 5. CreditLedger / PdfJob / UsageLedger / Vote / Correction / Glossary 全部保留（历史审计）
 */
export async function DELETE(req: NextRequest) {
  const token = await getSessionCookie();
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const user = await validateSession(token);
  if (!user) return NextResponse.json({ error: '会话已过期' }, { status: 401 });

  const userId = user.userId;

  // 1) 额度归零：CreditAccount 余额清零（写 Ledger 审计行）+ CreditGrant 归零
  await prisma.$transaction(async (tx) => {
    const acc = await tx.creditAccount.findUnique({ where: { userId } });
    if (acc && acc.balance + acc.reservedBalance > 0) {
      await tx.creditAccount.update({ where: { userId }, data: { balance: 0, reservedBalance: 0 } });
      await tx.creditLedger.create({
        data: {
          userId,
          type: 'admin_adjust',
          amount: -(acc.balance + acc.reservedBalance),
          idempotencyKey: `account_close:${userId}:${Date.now()}`,
          description: '账户注销，剩余额度清零',
          metadata: { reason: 'account_deleted' },
        },
      });
    }
    await tx.creditGrant.updateMany({ where: { userId, remainingAmount: { gt: 0 } }, data: { remainingAmount: 0, reservedAmount: 0 } });
  });

  // 2) Sessions revoke
  await revokeAllUserSessions(userId);

  // 3) 软删除 User：status=deleted + email 匿名化（保留 Ledger 等审计关联）
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'deleted',
      email: `deleted_${userId.slice(0, 8)}_${Date.now().toString(36)}@deleted.local`,
      nickname: '已注销用户',
      emailVerified: null,
    },
  });

  const res = NextResponse.json({ ok: true, message: '账户已删除，历史记录按隐私策略匿名保留。' });
  res.cookies.set('aifanyi_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('aifanyi_guest', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
