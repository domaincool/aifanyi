import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { generateReply } from '@/lib/ecommerce/assistant';
import { FEATURES } from '@/lib/credit/types';
import { estimateByChars, beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/ecommerce/messages/[id]/reply —— AI 回复建议（customer_reply 3/千字，按商品资料+消息字符计量）
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const message = await prisma.ecommerceCustomerMessage.findFirst({
    where: { id, userId, status: 'active' },
    include: { product: { select: { productName: true, sourceDescription: true } } },
  });
  if (!message) return NextResponse.json({ ok: false, error: '消息不存在或无权访问' }, { status: 404 });

  const chars = message.sourceText.length + (message.product?.productName?.length || 0) + (message.product?.sourceDescription?.length || 0);
  const estimated = await estimateByChars(FEATURES.CUSTOMER_REPLY, chars);

  const jobId = randomUUID();
  const begin = await beginSync({ userId, jobId, feature: FEATURES.CUSTOMER_REPLY, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const { reply, tone } = await generateReply({
      productName: message.product?.productName || '',
      productDescription: message.product?.sourceDescription || '',
      sourceText: message.sourceText,
      translation: message.translation || '',
      intent: message.intent || '',
      sourceLang: message.sourceLang || 'auto',
    });

    const replyJson = { reply, tone } as unknown as object;
    const updated = await prisma.ecommerceCustomerMessage.update({
      where: { id },
      data: { replyJson, tone },
      select: { id: true, replyJson: true, tone: true, updatedAt: true },
    });

    const settle = await endSyncSuccess({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: begin.estimated });
    return NextResponse.json({ ok: true, message: updated, consumedCredits: settle.consumed });
  } catch (e: any) {
    await endSyncFail({ userId, jobId, usageId: begin.usageId, estimated: begin.estimated });
    return NextResponse.json({ ok: false, error: e?.message || '生成回复失败，本次未扣费' }, { status: 500 });
  }
}
