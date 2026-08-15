import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { enrichProduct } from '@/lib/ecommerce/enrich';
import { FEATURES } from '@/lib/credit/types';
import { estimateCredits, charsToUnits } from '@/lib/credit/pricing';
import { beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/ecommerce/products/[id]/enrich —— AI 提取商品资料（Credit: product_enrich，按输入字符数计量）
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const product = await prisma.ecommerceProduct.findFirst({
    where: { id, userId },
    select: { id: true, productName: true, sourceDescription: true },
  });
  if (!product) return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });

  // 按输入字符数计量（product_enrich: per_1000_chars）
  const chars = (product.productName || '').length + (product.sourceDescription || '').length;
  const estimated = (await estimateCredits(FEATURES.PRODUCT_ENRICH, charsToUnits(chars)))?.credits ?? 3;

  // Credit：reserve（行锁原子检查余额；不足 402 拦截，绝不先执行后扣费）
  const jobId = randomUUID();
  const begin = await beginSync({ userId, jobId, feature: FEATURES.PRODUCT_ENRICH, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const enriched = await enrichProduct({ name: product.productName, description: product.sourceDescription });

    // 合并写回 product（仅覆盖 AI 有把握的字段）
    const patch: any = {};
    if (enriched.category) patch.category = String(enriched.category).slice(0, 100);
    if (enriched.brand) patch.brand = String(enriched.brand).slice(0, 100);
    if (Array.isArray(enriched.features) && enriched.features.length) patch.features = enriched.features;
    if (Array.isArray(enriched.specifications) && enriched.specifications.length) patch.specifications = enriched.specifications;
    if (Array.isArray(enriched.materials) && enriched.materials.length) patch.materials = enriched.materials;
    if (enriched.targetMarket) patch.targetMarket = String(enriched.targetMarket).slice(0, 50);

    if (Object.keys(patch).length > 0) {
      await prisma.ecommerceProduct.update({ where: { id }, data: patch });
    }

    // 结算：成功按实际 consume（enrich 固定单价，实际 = 预估）
    const settle = await endSyncSuccess({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: begin.estimated });
    if (!settle.ok) {
      return NextResponse.json({ ok: false, error: settle.error || '积分结算异常' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, enriched, consumedCredits: settle.consumed });
  } catch (e: any) {
    await endSyncFail({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
    return NextResponse.json({ ok: false, error: e?.message || 'AI 提取失败，本次未扣费' }, { status: 500 });
  }
}
