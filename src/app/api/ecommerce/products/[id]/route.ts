import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser, assertProductOwned } from '@/lib/ecommerce/guard';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/ecommerce/products/[id] —— 商品详情（含 current draft + 计数）
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const product = await prisma.ecommerceProduct.findFirst({
    where: { id, userId },
    include: {
      listings: { where: { status: 'current' }, orderBy: { version: 'desc' }, take: 1 },
      _count: { select: { assets: true, listings: true, messages: true } },
    },
  });
  if (!product) return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  return NextResponse.json({ ok: true, product });
}

// PATCH /api/ecommerce/products/[id] —— 更新商品资料（部分字段）
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  if (!(await assertProductOwned(userId, id))) {
    return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const data: any = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 120) return NextResponse.json({ ok: false, error: '商品名称不能为空且不超过 120 字' }, { status: 400 });
    data.productName = name;
  }
  if (body?.description !== undefined) data.sourceDescription = body.description ? String(body.description).slice(0, 5000) : null;
  if (body?.category !== undefined) data.category = body.category ? String(body.category) : null;
  if (body?.brand !== undefined) data.brand = body.brand ? String(body.brand) : null;
  if (body?.sku !== undefined) data.sku = body.sku ? String(body.sku) : null;
  if (body?.features !== undefined) data.features = Array.isArray(body.features) ? body.features : null;
  if (body?.specifications !== undefined) data.specifications = Array.isArray(body.specifications) ? body.specifications : null;
  if (body?.materials !== undefined) data.materials = Array.isArray(body.materials) ? body.materials : null;
  if (body?.dimensions !== undefined) data.dimensions = body.dimensions && typeof body.dimensions === 'object' ? body.dimensions : null;
  if (body?.targetMarket !== undefined) data.targetMarket = body.targetMarket ? String(body.targetMarket) : null;
  if (body?.platform !== undefined) data.platform = body.platform ? String(body.platform) : null;
  if (body?.sourceLang !== undefined) data.sourceLang = body.sourceLang ? String(body.sourceLang) : 'zh';

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: '没有可更新的字段' }, { status: 400 });
  }

  const product = await prisma.ecommerceProduct.update({ where: { id }, data });
  return NextResponse.json({ ok: true, product });
}

// DELETE /api/ecommerce/products/[id] —— soft delete（生命周期：DB soft delete → cleanup job → 删 Storage → 硬删）
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  if (!(await assertProductOwned(userId, id))) {
    return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  }

  await prisma.ecommerceProduct.update({
    where: { id },
    data: { status: 'deleted', deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
