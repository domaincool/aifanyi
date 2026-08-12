/**
 * POST /api/admin/credits/adjust — 调整额度（admin，必填 reason）
 * body: { userId, amount, reason }
 * 强制产生 Grant + Ledger，记录 adminId
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/credit/admin-auth';
import { adminAdjustment } from '@/lib/credit/engine';
import { GRANT_TYPES } from '@/lib/credit/types';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { userId, amount, reason } = body || {};
  if (!userId || typeof userId !== 'string') return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt === 0) return NextResponse.json({ error: 'amount 必须是非零整数' }, { status: 400 });
  if (!reason || typeof reason !== 'string' || reason.trim().length < 2) return NextResponse.json({ error: '必须填写调整原因（至少 2 字）' }, { status: 400 });

  const result = await adminAdjustment({
    userId,
    type: GRANT_TYPES.ADMIN_ADJUSTMENT,
    source: '管理员调整',
    amount: amt,
    reason: reason.trim(),
    adminId: admin.userId,
    idempotencyKey: `admin_adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });

  if (!result.ok) return NextResponse.json({ error: result.error === 'insufficient' ? '扣减超过用户当前可用额度' : '调整失败' }, { status: 400 });
  return NextResponse.json({ ok: true, amount: amt });
}
