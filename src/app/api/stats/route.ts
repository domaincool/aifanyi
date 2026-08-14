/**
 * GET /api/stats — 只读运营统计（盲测/翻译/成本/PDF/用户/内容）
 * 权限：requireOpsOrAdmin（运营 Agent Bearer token 或 admin session）——修复审计 P1「stats 无认证」
 * 用途：运营监控基线（每周快照 / 任意时刻自查）+ 管理看板
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/admin/ops-auth';
import { collectStats } from '@/lib/admin/stats';

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  try {
    const data = await collectStats();
    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      operator: identity.operator,
      ...data,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
