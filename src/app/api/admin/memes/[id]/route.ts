/**
 * /api/admin/memes/[id] — 词条编辑 / 删除（ops/admin）
 * PATCH  : 编辑字段（term/slug 变更查重；status 上下架）
 * DELETE : 软删（status=archived）；?hard=true 仅人工 admin 且 draft 可硬删
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOpsOrAdmin, logAdminAction, checkOpsRateLimit } from '@/lib/admin/ops-auth';
import { slugNorm } from '@/lib/admin/meme-import';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const rl = await checkOpsRateLimit(identity.operator, 'memes.', 20);
  if (!rl.ok) return NextResponse.json({ error: '操作过于频繁，请 10 分钟后再试' }, { status: 429 });

  const { id } = await params;
  const existing = await prisma.memeEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '词条不存在' }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const allowed = ['term', 'slug', 'meaning', 'translation', 'examples', 'tags', 'popularity', 'status'];
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '无字段可更新' }, { status: 400 });

  // term/slug 变更查重
  if (data.slug && String(data.slug) !== existing.slug) {
    const dup = await prisma.memeEntry.findFirst({ where: { slug: String(data.slug), NOT: { id } }, select: { slug: true } });
    if (dup) return NextResponse.json({ error: `slug 已存在：${dup.slug}` }, { status: 409 });
    // 双风格查重
    const norm = slugNorm(String(data.slug));
    const all = await prisma.memeEntry.findMany({ where: { NOT: { id } }, select: { slug: true } });
    const hit = all.find((s) => slugNorm(s.slug) === norm && s.slug !== data.slug);
    if (hit) return NextResponse.json({ error: `slug 与 ${hit.slug} 冲突（双风格归一）` }, { status: 409 });
  }
  if (data.term && String(data.term) !== existing.term) {
    const dup = await prisma.memeEntry.findUnique({ where: { term: String(data.term) } });
    if (dup) return NextResponse.json({ error: `term 已存在：${dup.term}` }, { status: 409 });
  }
  if (data.status && !['draft', 'published', 'archived'].includes(String(data.status))) {
    return NextResponse.json({ error: 'status 不合法' }, { status: 400 });
  }

  const updated = await prisma.memeEntry.update({ where: { id }, data: data as any });
  await logAdminAction({ identity, action: 'memes.update', targetId: id, params: { fields: Object.keys(data) }, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null });
  return NextResponse.json({ ok: true, meme: { id: updated.id, term: updated.term, slug: updated.slug, status: updated.status } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.memeEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '词条不存在' }, { status: 404 });

  const hard = req.nextUrl.searchParams.get('hard') === 'true';
  if (hard) {
    // 硬删仅限人工 admin，且仅 draft 可硬删
    if (identity.kind !== 'admin') return NextResponse.json({ error: '硬删除仅限人工管理员' }, { status: 403 });
    if (existing.status !== 'draft') return NextResponse.json({ error: '仅草稿可硬删，其余请软删' }, { status: 400 });
    await prisma.memeEntry.delete({ where: { id } });
    await logAdminAction({ identity, action: 'memes.delete_hard', targetId: id, params: { term: existing.term }, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null });
    return NextResponse.json({ ok: true, hard: true });
  }

  // 软删：archived
  await prisma.memeEntry.update({ where: { id }, data: { status: 'archived' } });
  await logAdminAction({ identity, action: 'memes.delete_soft', targetId: id, params: { term: existing.term }, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null });
  return NextResponse.json({ ok: true, hard: false });
}
