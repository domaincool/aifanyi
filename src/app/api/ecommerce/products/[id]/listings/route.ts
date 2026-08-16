import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser, assertProductOwned } from '@/lib/ecommerce/guard';
import { generateListing } from '@/lib/ecommerce/listing';
import { FEATURES } from '@/lib/credit/types';
import { estimateCredits, charsToUnits } from '@/lib/credit/pricing';
import { beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const DEFAULT_PLATFORM = 'amazon';
const DEFAULT_MARKET = '美国';
const DEFAULT_LANGUAGE = '英语';

// GET /api/ecommerce/products/[id]/listings —— 列版本（current + history，version desc）
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  if (!(await assertProductOwned(userId, id))) {
    return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  }

  const listings = await prisma.ecommerceListing.findMany({
    where: { productId: id },
    orderBy: { version: 'desc' },
    select: {
      id: true, version: true, status: true, draft: true, warnings: true,
      charCount: true, consumedCredits: true, metadata: true, createdAt: true,
    },
  });
  return NextResponse.json({ ok: true, listings });
}

// POST /api/ecommerce/products/[id]/listings —— 生成完整 Listing Draft（Credit: listing_generation，按输入字符计量）
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const product = await prisma.ecommerceProduct.findFirst({
    where: { id, userId },
    select: {
      id: true, productName: true, sourceDescription: true, category: true, brand: true,
      features: true, specifications: true, materials: true, targetMarket: true, platform: true,
    },
  });
  if (!product) return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const platform = String(body?.platform || product.platform || DEFAULT_PLATFORM).slice(0, 30);
  const market = String(body?.market || product.targetMarket || DEFAULT_MARKET).slice(0, 50);
  const language = String(body?.language || DEFAULT_LANGUAGE).slice(0, 30);

  // 输入字符数（商品资料拼接）→ 计量（per_1000_chars）
  const inputChars =
    (product.productName || '').length + (product.sourceDescription || '')!.length +
    (product.category || '').length + (product.brand || '').length +
    (Array.isArray(product.features) ? product.features.join('').length : 0) +
    (Array.isArray(product.specifications) ? product.specifications.join('').length : 0) +
    (Array.isArray(product.materials) ? product.materials.join('').length : 0) +
    (product.targetMarket || '').length;
  const estimated = (await estimateCredits(FEATURES.LISTING_GENERATION, charsToUnits(inputChars)))?.credits ?? 3;

  const jobId = randomUUID();
  const begin = await beginSync({ userId, jobId, feature: FEATURES.LISTING_GENERATION, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const result = await generateListing({
      product: {
        name: product.productName,
        category: product.category,
        brand: product.brand,
        features: Array.isArray(product.features) ? (product.features as string[]) : null,
        specifications: Array.isArray(product.specifications) ? (product.specifications as string[]) : null,
        materials: Array.isArray(product.materials) ? (product.materials as string[]) : null,
        targetMarket: product.targetMarket,
        description: product.sourceDescription,
      },
      platform, market, language,
    });

    const draftCharCount =
      result.draft.title.length + result.draft.description.length +
      result.draft.bulletPoints.join('').length +
      result.draft.keywords.join('').length +
      result.draft.faqHighlights.join('').length;

    // 事务：旧 current → history；新 current（version+1）+ run
    const maxV = await prisma.ecommerceListing.aggregate({ where: { productId: id }, _max: { version: true } });
    const newVersion = (maxV._max.version ?? 0) + 1;

    const listing = await prisma.$transaction(async (tx) => {
      await tx.ecommerceListing.updateMany({
        where: { productId: id, status: 'current' },
        data: { status: 'history' },
      });
      const created = await tx.ecommerceListing.create({
        data: {
          productId: id,
          userId,
          version: newVersion,
          draft: result.draft as unknown as object,
          status: 'current',
          charCount: draftCharCount,
          warnings: result.warnings.length ? (result.warnings as unknown as object) : undefined,
          consumedCredits: begin.estimated,
          metadata: { platform, market, language, model: 'deepseek' } as unknown as object,
        },
      });
      await tx.ecommerceListingRun.create({
        data: {
          productId: id,
          userId,
          platform, market, language,
          inputSnapshot: { name: product.productName, category: product.category, brand: product.brand } as unknown as object,
          output: result.draft as unknown as object,
          warnings: result.warnings.length ? (result.warnings as unknown as object) : undefined,
          status: 'success',
          idempotencyKey: jobId,
        },
      });
      return created;
    });

    const settle = await endSyncSuccess({
      userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: begin.estimated,
      costUsd: (result.draft ? (result.draft.title.length + result.draft.description.length + result.draft.bulletPoints.join('').length + result.draft.keywords.join('').length + result.draft.faqHighlights.join('').length) : 0) / 1000 * 0.0014,
      provider: 'deepseek|glm', model: 'multi', inputTokens: 0, outputTokens: 0,
    });
    if (!settle.ok) {
      return NextResponse.json({ ok: false, error: settle.error || '积分结算异常' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      listing: { id: listing.id, version: listing.version, status: listing.status, draft: listing.draft, warnings: listing.warnings, charCount: listing.charCount, metadata: listing.metadata, createdAt: listing.createdAt },
      warnings: result.warnings,
      consumedCredits: settle.consumed,
    });
  } catch (e: any) {
    await endSyncFail({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
    return NextResponse.json({ ok: false, error: e?.message || 'Listing 生成失败，本次未扣费' }, { status: 500 });
  }
}
