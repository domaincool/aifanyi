/**
 * POST /api/credits/webhook/[provider]
 * 真实渠道支付回调：验签 → 解析事件 → 支付成功则 grantRechargeOrder（幂等）
 * mock 模式无此回调（由 /api/credits/confirm 代替）
 */
import { NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payment';
import { grantRechargeOrder } from '@/lib/payment/grant';

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = getPaymentProvider();

  if (providerParam !== provider.code) {
    return NextResponse.json({ error: 'unknown provider' }, { status: 404 });
  }
  if (provider.code === 'mock') {
    return NextResponse.json({ error: 'mock 无 webhook' }, { status: 400 });
  }

  const rawBody = await req.text();
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  let result;
  try {
    result = await provider.verifyWebhook(rawBody, headers);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'webhook 处理失败' }, { status: 500 });
  }

  if (!result.valid) {
    return NextResponse.json({ error: result.reason || 'invalid signature' }, { status: 401 });
  }
  if (!result.paid) {
    return NextResponse.json({ ok: true, ignored: true, event: result.event });
  }

  const grant = await grantRechargeOrder(result.orderId, {
    allowExpired: true,
    expectedProviderOrderId: result.providerOrderId || undefined,
  });
  if (!grant.ok) {
    return NextResponse.json({ error: grant.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, granted: grant.granted, already: grant.already });
}
