import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/ecommerce/listings/[id]/restore —— 恢复历史版本为当前版本（复制成新 current，version+1，不扣费）
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const source = await prisma.ecommerceListing.findFirst({
    where: { id, userId },
    select: { id: true, productId: true, draft: true, warnings: true, charCount: true, metadata: true },
  });
  if (!source) return NextResponse.json({ ok: false, error: 'Listing 不存在或无权访问' }, { status: 404 });

  const maxV = await prisma.ecommerceListing.aggregate({ where: { productId: source.productId }, _max: { version: true } });
  const newVersion = (maxV._max.version ?? 0) + 1;

  const listing = await prisma.$transaction(async (tx) => {
    await tx.ecommerceListing.updateMany({
      where: { productId: source.productId, status: 'current' },
      data: { status: 'history' },
    });
    return tx.ecommerceListing.create({
      data: {
        productId: source.productId,
        userId,
        version: newVersion,
        draft: source.draft as unknown as object,
        status: 'current',
        charCount: source.charCount,
        warnings: (source.warnings ?? undefined) as unknown as object | undefined,
        consumedCredits: 0,
        metadata: (source.metadata ?? undefined) as unknown as object | undefined,
      },
      select: { id: true, version: true, status: true, draft: true, warnings: true, charCount: true, metadata: true, createdAt: true },
    });
  });

  return NextResponse.json({ ok: true, listing });
}
