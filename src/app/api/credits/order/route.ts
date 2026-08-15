/**
 * GET /api/credits/order?orderId=xxx
 * 查询充值订单状态（登录态，仅本人订单）
 * 用途：支付成功跳回 /credit?paid=<orderId> 后，前端轮询此接口确认到账
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserId } from '@/lib/credit/sync-settle';

export async function GET(req: Request) {
  const auth = await getAuthUserId();
  if (!auth) {
    return NextResponse.json({ ok: false, error: '请先登录。' }, { status: 401 });
  }
  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId') || '';
  if (!orderId) {
    return NextResponse.json({ ok: false, error: '缺少 orderId。' }, { status: 400 });
  }
  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: '订单不存在。' }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    status: order.status,
    planName: order.planName,
    granted: order.status === 'granted'
      ? { purchased: order.purchasedCredits, bonus: order.bonusCredits }
      : null,
  });
}
