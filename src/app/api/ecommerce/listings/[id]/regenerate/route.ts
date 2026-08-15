import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { regenerateField, type ListingField } from '@/lib/ecommerce/listing';
import { FEATURES } from '@/lib/credit/types';
import { estimateCredits, charsToUnits } from '@/lib/credit/pricing';
import { beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const FIELDS: ListingField[] = ['title', 'bulletPoints', 'description', 'keywords', 'faqHighlights'];

// POST /api/ecommerce/listings/[id]/regenerate —— 逐字段重生成（Credit: listing_rewrite，按字段内容计量）
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const listing = await prisma.ecommerceListing.findFirst({
    where: { id, userId },
    select: { id: true, productId: true, draft: true, warnings: true, status: true, metadata: true },
  });
  if (!listing) return NextResponse.json({ ok: false, error: 'Listing 不存在或无权访问' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const field = String(body?.field || '');
  if (!FIELDS.includes(field as ListingField)) {
    return NextResponse.json({ ok: false, error: '无效的字段' }, { status: 400 });
  }

  const product = await prisma.ecommerceProduct.findFirst({
    where: { id: listing.productId, userId },
    select: {
      id: true, productName: true, sourceDescription: true, category: true, brand: true,
      features: true, specifications: true, materials: true, targetMarket: true, platform: true,
    },
  });
  if (!product) return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });

  const draft = (listing.draft || {}) as any;
  const meta = (listing.metadata || {}) as any;
  const platform = String(meta?.platform || product.platform || 'amazon');
  const market = String(meta?.market || product.targetMarket || '美国');
  const language = String(meta?.language || '英语');

  const cur = draft[field];
  const curText = Array.isArray(cur) ? cur.join('') : String(cur || '');
  const chars = curText.length + (product.productName || '').length;
  const estimated = (await estimateCredits(FEATURES.LISTING_REWRITE, charsToUnits(chars)))?.credits ?? 2;

  const jobId = randomUUID();
  const begin = await beginSync({ userId, jobId, feature: FEATURES.LISTING_REWRITE, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const result = await regenerateField({
      field: field as ListingField,
      currentDraft: {
        title: String(draft.title || ''),
        bulletPoints: Array.isArray(draft.bulletPoints) ? draft.bulletPoints : [],
        description: String(draft.description || ''),
        keywords: Array.isArray(draft.keywords) ? draft.keywords : [],
        faqHighlights: Array.isArray(draft.faqHighlights) ? draft.faqHighlights : [],
      },
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

    const newDraft = { ...draft, [field]: result.value };

    // warnings 合并（去重追加，保留其他字段的待确认项）
    const oldWarnings: string[] = Array.isArray(listing.warnings) ? (listing.warnings as string[]) : [];
    const merged = Array.from(new Set([...oldWarnings, ...result.warnings]));

    const updated = await prisma.ecommerceListing.update({
      where: { id },
      data: {
        draft: newDraft as unknown as object,
        warnings: merged.length ? (merged as unknown as object) : undefined,
        charCount: JSON.stringify(newDraft).length,
      },
      select: { id: true, version: true, status: true, draft: true, warnings: true, charCount: true, metadata: true, createdAt: true },
    });

    const settle = await endSyncSuccess({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: begin.estimated });
    if (!settle.ok) {
      return NextResponse.json({ ok: false, error: settle.error || '积分结算异常' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, listing: updated, warnings: result.warnings, consumedCredits: settle.consumed });
  } catch (e: any) {
    await endSyncFail({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
    return NextResponse.json({ ok: false, error: e?.message || '重生成失败，本次未扣费' }, { status: 500 });
  }
}
