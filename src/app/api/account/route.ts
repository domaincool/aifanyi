import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
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
 * 删除账户：级联删除 User（onDelete Cascade 自动清理 AuthIdentity/Session/CreditAccount/DocumentProgress）
 * + 手动清理 PdfJob/UsageLedger 等无级联关系的表
 * 用户删除后所有旧 URL 均无法访问（ownership 检查 userId 不匹配）
 */
export async function DELETE(req: NextRequest) {
  const token = await getSessionCookie();
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const user = await validateSession(token);
  if (!user) return NextResponse.json({ error: '会话已过期' }, { status: 401 });

  const userId = user.userId;

  // 1) 手动清理无级联的表（PdfJob / UsageLedger / Vote / Correction / Glossary / CreditLedger）
  await prisma.$transaction([
    prisma.pdfJob.deleteMany({ where: { userId } }),
    prisma.usageLedger.deleteMany({ where: { userId } }),
    prisma.vote.deleteMany({ where: { userId } }),
    prisma.correction.deleteMany({ where: { userId } }),
    prisma.glossary.deleteMany({ where: { userId } }),
    prisma.creditLedger.deleteMany({ where: { userId } }),
  ]);

  // 2) 删除 User（Cascade: AuthIdentity / Session / CreditAccount / DocumentProgress 关联）
  await prisma.user.delete({ where: { id: userId } });

  const res = NextResponse.json({ ok: true, message: '账户已删除。' });
  res.cookies.set('aifanyi_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('aifanyi_guest', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
