/**
 * /api/admin/blindtests/[id] — 盲测题编辑 / 删除（ops/admin）
 * PATCH  : 仅允许 status（上下架）；译文变更需重建题目
 * DELETE : 软删（archived）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOpsOrAdmin, logAdminAction, checkOpsRateLimit } from '@/lib/admin/ops-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const rl = await checkOpsRateLimit(identity.operator, 'blindtests.', 20);
  if (!rl.ok) return NextResponse.json({ error: '操作过于频繁，请 10 分钟后再试' }, { status: 429 });

  const { id } = await params;
  const existing = await prisma.blindtest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '题目不存在' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const status = String(body?.status || '');
  if (!status || !['draft', 'published', 'archived'].includes(status)) {
    return NextResponse.json({ error: '仅支持 status 字段（draft/published/archived），译文变更请重建题目' }, { status: 400 });
  }

  await prisma.blindtest.update({ where: { id }, data: { status } });
  await logAdminAction({
    identity, action: 'blindtests.update', targetId: id,
    params: { status, sourceText: existing.sourceText.slice(0, 60) },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });
  return NextResponse.json({ ok: true, id, status });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.blindtest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '题目不存在' }, { status: 404 });

  await prisma.blindtest.update({ where: { id }, data: { status: 'archived' } });
  await logAdminAction({
    identity, action: 'blindtests.delete_soft', targetId: id,
    params: { sourceText: existing.sourceText.slice(0, 60) },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });
  return NextResponse.json({ ok: true, hard: false });
}
