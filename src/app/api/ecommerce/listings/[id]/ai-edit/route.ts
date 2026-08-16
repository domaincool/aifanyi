import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { editField, type ListingField } from '@/lib/ecommerce/listing-edit';
import { FEATURES } from '@/lib/credit/types';
import { estimateCredits, charsToUnits } from '@/lib/credit/pricing';
import { beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const FIELDS: ListingField[] = ['title', 'bulletPoints', 'description', 'keywords', 'faqHighlights'];
const MAX_INSTRUCTION = 1000;

// 字段名 → PlatformRule.field（下划线命名）
const FIELD_TO_RULE: Record<ListingField, string | null> = {
  title: 'title',
  bulletPoints: 'bullet_points',
  description: 'description',
  keywords: 'keywords',
  faqHighlights: null,
};

// POST /api/ecommerce/listings/[id]/ai-edit —— AI 微调（最小必要修改）。
// 只返回 preview + 暂存 pendingEdit，不覆盖 Listing；应用走 /apply-edit。
// Credit: listing_ai_edit（按当前字段内容 + 指令字符计量）。context 全部后端从 DB 取，不信任前端。
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const listing = await prisma.ecommerceListing.findFirst({
    where: { id, userId },
    select: { id: true, productId: true, draft: true, metadata: true },
  });
  if (!listing) return NextResponse.json({ ok: false, error: 'Listing 不存在或无权访问' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const field = String(body?.field || '');
  const instruction = String(body?.instruction || '').trim();
  const idemKey = String(body?.idempotencyKey || '').slice(0, 100);

  if (!FIELDS.includes(field as ListingField)) {
    return NextResponse.json({ ok: false, error: '无效的字段' }, { status: 400 });
  }
  if (!instruction) {
    return NextResponse.json({ ok: false, error: '请填写修改要求' }, { status: 400 });
  }
  if (instruction.length > MAX_INSTRUCTION) {
    return NextResponse.json({ ok: false, error: `修改要求过长（最多 ${MAX_INSTRUCTION} 字符）` }, { status: 400 });
  }

  // 幂等：同一 idempotencyKey 已完成则拒绝重复提交（防连续点击重复执行/重复扣费）
  const jobId = idemKey || randomUUID();
  if (idemKey) {
    const existing = await prisma.usageRecord.findFirst({ where: { userId, jobId } });
    if (existing && existing.status === 'consumed') {
      return NextResponse.json({ ok: false, code: 'duplicate', error: '该修改已在处理中或已完成，请勿重复提交' }, { status: 409 });
    }
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

  // 平台规则（后端从 DB 查，不信任前端）
  const ruleField = FIELD_TO_RULE[field as ListingField];
  const ruleRows = ruleField
    ? await prisma.ecommercePlatformRule.findMany({
        where: { platform, field: ruleField, active: true },
        orderBy: { version: 'desc' },
        select: { field: true, minLength: true, maxLength: true, recommendedLength: true, rules: true },
      })
    : [];

  const cur = draft[field];
  const curText = Array.isArray(cur) ? cur.join('') : String(cur || '');
  const chars = curText.length + instruction.length;
  const estimated = (await estimateCredits(FEATURES.LISTING_AI_EDIT, charsToUnits(chars)))?.credits ?? 2;

  const begin = await beginSync({ userId, jobId, feature: FEATURES.LISTING_AI_EDIT, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const result = await editField({
      field: field as ListingField,
      instruction,
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
      platformRules: ruleRows.map((r) => ({
        field: r.field, minLength: r.minLength, maxLength: r.maxLength, recommendedLength: r.recommendedLength, rules: r.rules,
      })),
    });

    // 暂存 pendingEdit（不覆盖 Listing），apply 时后端从 DB 读，前端无法篡改 content
    await prisma.ecommerceListing.update({
      where: { id },
      data: {
        pendingEdit: {
          field, instruction,
          content: result.content,
          changes: result.changes,
          warnings: result.warnings,
          factConflicts: result.factConflicts,
          platformIssues: result.platformIssues,
          createdAt: new Date().toISOString(),
        } as unknown as object,
      },
    });

    const settle = await endSyncSuccess({
      userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: begin.estimated,
      costUsd: (result.content ? String(result.content).length : 0) / 1000 * 0.0014, // DeepSeek 约 $0.0014/千字符
      provider: 'deepseek|glm', model: 'multi', inputTokens: 0, outputTokens: 0,
    });
    if (!settle.ok) {
      return NextResponse.json({ ok: false, error: settle.error || '积分结算异常' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      preview: {
        field,
        original: curText,
        content: result.content,
        changes: result.changes,
        warnings: result.warnings,
        factConflicts: result.factConflicts,
        platformIssues: result.platformIssues,
      },
      consumedCredits: settle.consumed,
    });
  } catch (e: any) {
    await endSyncFail({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
    return NextResponse.json({ ok: false, error: e?.message || 'AI 修改失败，积分已退回，请稍后重试。' }, { status: 500 });
  }
}
