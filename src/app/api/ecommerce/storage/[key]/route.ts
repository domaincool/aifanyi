import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { getStorageService } from '@/lib/storage/storage-service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ key: string }> };

// GET /api/ecommerce/storage/[key] —— 本地存储回源代理（鉴权后回源，S3 模式下由真实 Signed URL 直连，不经此路由）
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { key } = await params;

  // 校验该 storageKey 归属当前用户（任一资产，避免泄露他人文件）
  const asset = await prisma.ecommerceAsset.findFirst({
    where: { storageKey: key, userId },
    select: { id: true },
  });
  if (!asset) return NextResponse.json({ ok: false, error: '文件不存在或无权访问' }, { status: 404 });

  const file = await getStorageService().get(key);
  const body = new Uint8Array(file.data);
  return new NextResponse(body, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=900',
      'Content-Length': String(file.data.byteLength),
    },
  });
}
