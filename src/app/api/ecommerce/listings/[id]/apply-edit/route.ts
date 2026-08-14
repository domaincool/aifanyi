import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/ecommerce/listings/[id]/apply-edit —— 应用 AI 微调结果（创建新 version，旧 version 保留）。
// 修改后内容从 DB 的 pendingEdit 读取，前端只传 listingId，不信任前端传 content（防绕过 Fact Validation）。
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const listing = await prisma.ecommerceListing.findFirst({
    where: { id, userId },
    select: { id: true, productId: true, draft: true, warnings: true, metadata: true, pendingEdit: true },
  });
  if (!listing) return NextResponse.json({ ok: false, error: 'Listing 不存在或无权访问' }, { status: 404 });

  const pending = (listing.pendingEdit || {}) as any;
  const field = String(pending?.field || '');
  const FIELDS = ['title', 'bulletPoints', 'description', 'keywords', 'faqHighlights'];
  if (!FIELDS.includes(field) || pending?.content === undefined || pending?.content === null) {
    return NextResponse.json({ ok: false, error: '没有待应用的修改' }, { status: 400 });
  }

  const draft = (listing.draft || {}) as any;
  const newDraft = { ...draft, [field]: pending.content };

  // 合并 warnings（原待确认项 + 本次微调的 warnings/fact_conflicts/platform_issues）
  const oldWarnings: string[] = Array.isArray(listing.warnings) ? (listing.warnings as string[]) : [];
  const extra: string[] = [
    ...(Array.isArray(pending.warnings) ? pending.warnings : []),
    ...(Array.isArray(pending.factConflicts) ? pending.factConflicts : []),
    ...(Array.isArray(pending.platformIssues) ? pending.platformIssues : []),
  ].map((x) => String(x));
  const merged = Array.from(new Set([...oldWarnings, ...extra]));

  const maxV = await prisma.ecommerceListing.aggregate({ where: { productId: listing.productId }, _max: { version: true } });
  const newVersion = (maxV._max.version ?? 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    await tx.ecommerceListing.updateMany({
      where: { productId: listing.productId, status: 'current' },
      data: { status: 'history' },
    });
    return tx.ecommerceListing.create({
      data: {
        productId: listing.productId,
        userId,
        version: newVersion,
        draft: newDraft as unknown as object,
        status: 'current',
        charCount: JSON.stringify(newDraft).length,
        warnings: merged.length ? (merged as unknown as object) : undefined,
        consumedCredits: 0, // AI 微调的 credit 已在 ai-edit 阶段扣费
        metadata: (listing.metadata ?? undefined) as unknown as object | undefined,
      },
      select: { id: true, version: true, status: true, draft: true, warnings: true, charCount: true, metadata: true, createdAt: true },
    });
  });

  // 清空原 listing 的 pendingEdit（原记录已变 history，id 不变）
  await prisma.ecommerceListing.update({ where: { id }, data: { pendingEdit: Prisma.DbNull } });

  return NextResponse.json({ ok: true, listing: created });
}
