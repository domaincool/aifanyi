import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { requireEcomUser } from '@/lib/ecommerce/guard';
import { retoneReply } from '@/lib/ecommerce/assistant';
import { FEATURES } from '@/lib/credit/types';
import { estimateByChars, beginSync, endSyncSuccess, endSyncFail } from '@/lib/credit/sync-settle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const TONES = new Set(['professional', 'friendly', 'concise']);

// POST /api/ecommerce/messages/[id]/retone —— 语气重写（复用 listing_rewrite 2/千字，按回复文本字符计量）
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  const message = await prisma.ecommerceCustomerMessage.findFirst({
    where: { id, userId, status: 'active' },
    select: { id: true, replyJson: true },
  });
  if (!message) return NextResponse.json({ ok: false, error: '消息不存在或无权访问' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const tone = String(body?.tone || 'professional');
  if (!TONES.has(tone)) {
    return NextResponse.json({ ok: false, error: '不支持的语气档（professional/friendly/concise）' }, { status: 400 });
  }

  const currentReply = ((message.replyJson as any)?.reply as string) || '';
  if (!currentReply) {
    return NextResponse.json({ ok: false, error: '请先生成回复后再调整语气' }, { status: 400 });
  }

  const estimated = await estimateByChars(FEATURES.LISTING_REWRITE, currentReply.length);

  const jobId = randomUUID();
  const begin = await beginSync({ userId, jobId, feature: FEATURES.LISTING_REWRITE, estimatedCredits: estimated });
  if (!begin.ok) {
    const status = begin.code === 'insufficient' ? 402 : 500;
    return NextResponse.json({ ok: false, code: begin.code, error: begin.error }, { status });
  }

  try {
    const { reply } = await retoneReply({ reply: currentReply, tone });
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
    return NextResponse.json({ ok: false, error: e?.message || '语气重写失败，本次未扣费' }, { status: 500 });
  }
}
