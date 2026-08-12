/**
 * GET /api/admin/credits/users/:id — 单用户 Ledger/Usage（admin）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/credit/admin-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 });
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  const acc = await prisma.creditAccount.findUnique({ where: { userId: id } });
  const grants = await prisma.creditGrant.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 });
  const ledger = await prisma.creditLedger.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
  const usage = await prisma.usageRecord.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 30 });
  const jobs = await prisma.pdfJob.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { taskId: true, fileName: true, status: true, creditState: true, reservedCredits: true, consumedCredits: true, createdAt: true } });

  return NextResponse.json({
    user: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt },
    account: acc,
    grants,
    ledger,
    usage,
    jobs,
  });
}
