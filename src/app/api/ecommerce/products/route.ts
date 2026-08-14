import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser, getOrCreateDefaultProject, assertProjectOwned } from '@/lib/ecommerce/guard';

export const dynamic = 'force-dynamic';

// GET /api/ecommerce/products —— 列出商品（?projectId= 过滤 / ?q= 模糊搜索）
export async function GET(req: Request) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const q = url.searchParams.get('q')?.trim();

  const where: any = { userId, status: 'active' };
  if (projectId) where.projectId = projectId;
  if (q) where.productName = { contains: q, mode: 'insensitive' };

  const products = await prisma.ecommerceProduct.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      projectId: true,
      productName: true,
      category: true,
      brand: true,
      sourceLang: true,
      targetMarket: true,
      platform: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { listings: true, assets: true } },
    },
  });
  return NextResponse.json({ ok: true, products });
}

// POST /api/ecommerce/products —— 创建商品（Quick: name+desc；Advanced: 完整资料）
export async function POST(req: Request) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const name = String(body?.name || '').trim();
  if (!name || name.length > 120) {
    return NextResponse.json({ ok: false, error: '商品名称不能为空且不超过 120 字' }, { status: 400 });
  }

  let projectId: string;
  if (body?.projectId) {
    if (!(await assertProjectOwned(userId, String(body.projectId)))) {
      return NextResponse.json({ ok: false, error: '项目不存在或无权访问' }, { status: 403 });
    }
    projectId = String(body.projectId);
  } else {
    projectId = (await getOrCreateDefaultProject(userId)).id;
  }

  const data: any = {
    projectId,
    userId,
    productName: name,
  };
  if (body?.description) data.sourceDescription = String(body.description).slice(0, 5000);
  if (body?.category) data.category = String(body.category);
  if (body?.brand) data.brand = String(body.brand);
  if (body?.sku) data.sku = String(body.sku);
  if (Array.isArray(body?.features)) data.features = body.features;
  if (Array.isArray(body?.specifications)) data.specifications = body.specifications;
  if (Array.isArray(body?.materials)) data.materials = body.materials;
  if (body?.dimensions && typeof body.dimensions === 'object') data.dimensions = body.dimensions;
  if (body?.targetMarket) data.targetMarket = String(body.targetMarket);
  if (body?.platform) data.platform = String(body.platform);
  data.sourceLang = body?.sourceLang ? String(body.sourceLang) : 'zh';

  const product = await prisma.ecommerceProduct.create({ data });
  return NextResponse.json({ ok: true, product }, { status: 201 });
}
