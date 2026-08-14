import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { translateAssetImage } from '@/lib/ecommerce/asset';
import { FEATURES } from '@/lib/credit/types';
import { estimateCredits } from '@/lib/credit/pricing';
import { beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';
import { isSupportedLanguage } from '@/lib/language-registry';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/ecommerce/assets/[id]/translate —— OCR + 逐行翻译（Credit: image_ocr，1 credit/张）
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const asset = await prisma.ecommerceAsset.findFirst({
    where: { id, userId, status: 'active' },
    select: { id: true, storageKey: true, mime: true },
  });
  if (!asset) return NextResponse.json({ ok: false, error: '资产不存在或无权访问' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const targetLang = String(body?.targetLang || 'en');
  if (!isSupportedLanguage(targetLang)) {
    return NextResponse.json({ ok: false, error: '不支持的目标语言' }, { status: 400 });
  }

  const estimated = (await estimateCredits(FEATURES.IMAGE_OCR, 1))?.credits ?? 1;

  const jobId = randomUUID();
  const begin = await beginSync({ userId, jobId, feature: FEATURES.IMAGE_OCR, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const { ocrLines, translatedLines } = await translateAssetImage({ storageKey: asset.storageKey, targetLang });

    const translation = await prisma.ecommerceAssetTranslation.create({
      data: {
        assetId: asset.id,
        userId,
        targetLang,
        ocrText: ocrLines as unknown as object,
        translated: translatedLines as unknown as object,
        status: 'success',
        consumedCredits: estimated,
      },
      select: { id: true, targetLang: true, ocrText: true, translated: true, status: true, consumedCredits: true, createdAt: true },
    });

    const settle = await endSyncSuccess({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: begin.estimated });
    if (!settle.ok) {
      return NextResponse.json({ ok: false, error: settle.error || '额度结算异常' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, translation, consumedCredits: settle.consumed });
  } catch (e: any) {
    await endSyncFail({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
    return NextResponse.json({ ok: false, error: e?.message || '图片翻译失败，本次未扣费' }, { status: 500 });
  }
}
