import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { getStorageService } from '@/lib/storage/storage-service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/ecommerce/assets/[id] —— 短期访问 URL（15min TTL，鉴权后直连 Storage，不公开永久 URL）
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const asset = await prisma.ecommerceAsset.findFirst({
    where: { id, userId, status: 'active' },
    select: { id: true, storageKey: true, mime: true, originalName: true, type: true, size: true, createdAt: true },
  });
  if (!asset) return NextResponse.json({ ok: false, error: '资产不存在或无权访问' }, { status: 404 });

  const url = await getStorageService().getSignedUrl(asset.storageKey, 15 * 60);
  return NextResponse.json({ ok: true, asset, url, expiresIn: 15 * 60 });
}

// DELETE /api/ecommerce/assets/[id] —— soft delete（生命周期：soft delete → cleanup job → 删 Storage → 硬删）
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const asset = await prisma.ecommerceAsset.findFirst({ where: { id, userId } });
  if (!asset) return NextResponse.json({ ok: false, error: '资产不存在或无权访问' }, { status: 404 });

  await prisma.ecommerceAsset.update({
    where: { id },
    data: { status: 'deleted', deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
