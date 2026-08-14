import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser, assertProductOwned, getOrCreateDefaultProject } from '@/lib/ecommerce/guard';
import { getStorageService } from '@/lib/storage/storage-service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

// GET /api/ecommerce/products/[id]/assets —— 列商品图片资产
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  if (!(await assertProductOwned(userId, id))) {
    return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  }

  const assets = await prisma.ecommerceAsset.findMany({
    where: { productId: id, status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, type: true, mime: true, size: true, originalName: true, createdAt: true,
      _count: { select: { translations: true } },
    },
  });
  return NextResponse.json({ ok: true, assets });
}

// POST /api/ecommerce/products/[id]/assets —— 上传商品图片（multipart，经 StorageService 落盘）
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  if (!(await assertProductOwned(userId, id))) {
    return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: '请上传图片文件' }, { status: 400 });
  }
  const file = form.get('file') as File | null;
  if (!file || !file.name) {
    return NextResponse.json({ ok: false, error: '请选择图片文件' }, { status: 400 });
  }
  const mime = file.type || 'image/png';
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ ok: false, error: '仅支持 PNG / JPG / WebP / GIF 图片' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: '图片过大（限 5MB）' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const stored = await getStorageService().upload(buf, { contentType: mime, originalName: file.name });

  const project = await getOrCreateDefaultProject(userId);
  const asset = await prisma.ecommerceAsset.create({
    data: {
      projectId: project.id,
      productId: id,
      userId,
      type: 'image',
      mime,
      size: buf.byteLength,
      storageKey: stored.storageKey,
      originalName: file.name,
    },
    select: { id: true, type: true, mime: true, size: true, originalName: true, storageKey: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, asset }, { status: 201 });
}
