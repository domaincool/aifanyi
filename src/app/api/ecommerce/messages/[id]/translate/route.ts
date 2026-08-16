import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { translateCustomerMessage } from '@/lib/ecommerce/assistant';
import { FEATURES } from '@/lib/credit/types';
import { estimateByChars, beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/ecommerce/messages/[id]/translate —— 翻译客户消息 + 意图识别（customer_translation 2/千字）
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const message = await prisma.ecommerceCustomerMessage.findFirst({
    where: { id, userId, status: 'active' },
    select: { id: true, sourceText: true, sourceLang: true },
  });
  if (!message) return NextResponse.json({ ok: false, error: '消息不存在或无权访问' }, { status: 404 });

  const estimated = await estimateByChars(FEATURES.CUSTOMER_TRANSLATION, message.sourceText.length);

  const jobId = randomUUID();
  const begin = await beginSync({ userId, jobId, feature: FEATURES.CUSTOMER_TRANSLATION, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const { translation, intent } = await translateCustomerMessage({ sourceText: message.sourceText, sourceLang: message.sourceLang });
    const updated = await prisma.ecommerceCustomerMessage.update({
      where: { id },
      data: { translation, intent },
      select: { id: true, sourceText: true, translation: true, intent: true, updatedAt: true },
    });

    const settle = await endSyncSuccess({
      userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: begin.estimated,
      costUsd: 0.001, // 客户消息翻译：按次估算
      provider: 'deepseek|glm', model: 'multi', inputTokens: 0, outputTokens: 0,
    });
    return NextResponse.json({ ok: true, message: updated, consumedCredits: settle.consumed });
  } catch (e: any) {
    await endSyncFail({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
    return NextResponse.json({ ok: false, error: e?.message || '翻译失败，本次未扣费' }, { status: 500 });
  }
}
