/**
 * GET /api/admin/credits/reconcile — 对账报告（admin）
 * 当前 mismatch 检查 + ReconciliationRecord 历史
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/credit/admin-auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  // 实时对账
  const mismatches: any[] = await prisma.$queryRaw`
    SELECT a."userId", (a.balance + a."reservedBalance") AS total, COALESCE(SUM(l.amount), 0) AS ledger, (a.balance + a."reservedBalance") - COALESCE(SUM(l.amount), 0) AS diff
    FROM "CreditAccount" a
    LEFT JOIN "CreditLedger" l ON l."userId" = a."userId"
    GROUP BY a."userId", a.balance, a."reservedBalance"
    HAVING (a.balance + a."reservedBalance") != COALESCE(SUM(l.amount), 0)
  `;

  const records = await prisma.reconciliationRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    mismatchCount: mismatches.length,
    mismatches,
    records,
  });
}
