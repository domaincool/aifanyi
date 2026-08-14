/**
 * GET /api/admin/audit — 审计日志（ops/admin）
 * 分页 + 可选过滤（operator / action）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOpsOrAdmin } from '@/lib/admin/ops-auth';

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const operator = (sp.get('operator') || '').trim();
  const action = (sp.get('action') || '').trim();

  const where: any = {};
  if (operator) where.operator = operator;
  if (action) where.action = { contains: action };

  const [total, logs] = await Promise.all([
    prisma.adminLog.count({ where }),
    prisma.adminLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize: PAGE_SIZE,
    operator: identity.operator,
    logs: logs.map((l) => ({
      id: l.id, operator: l.operator, action: l.action, targetId: l.targetId,
      batchId: l.batchId, params: l.params, result: l.result, ip: l.ip, createdAt: l.createdAt,
    })),
  });
}
