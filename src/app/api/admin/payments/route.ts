/**
 * /api/admin/payments —— 退款 / 补单 / 用户余额与订单查询（ops-auth 保护）
 *
 * P1-A-4b：admin 退款 / 补单薄后端
 *
 *  - GET  ?userId=xxx | ?email=xxx            → 用户余额 + 最近流水 + 充值订单
 *  - GET  ?q=xxx（订单 ID 或渠道订单号）      → 订单详情（补单前核对用）
 *  - POST { action: 'refund', ... }           → engine.refund（幂等，REFUND Ledger + 审计）
 *  - POST { action: 'complete_order', ... }   → grantRechargeOrder（补单：严格校验渠道订单号 + 审计）
 *
 * 鉴权：requireOpsOrAdmin（Bearer OPS_API_TOKEN 或 admin session）；所有写操作 logAdminAction 留痕。
 * 补单 ≠ 伪造支付：仅限真实已收款未到账订单，详见 handleCompleteOrder 校验清单。
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOpsOrAdmin, logAdminAction, checkOpsRateLimit, type OpsIdentity } from '@/lib/admin/ops-auth';
import { getBalance, refund } from '@/lib/credit/engine';
import { grantRechargeOrder } from '@/lib/payment/grant';

const MAX_REFUND = 1_000_000;

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

function orderRow(o: any) {
  return {
    id: o.id,
    planCode: o.planCode,
    planName: o.planName,
    priceCents: o.priceCents,
    purchasedCredits: o.purchasedCredits,
    bonusCredits: o.bonusCredits,
    status: o.status,
    provider: o.provider,
    providerOrderId: o.providerOrderId,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    grantedAt: o.grantedAt,
    expiresAt: o.expiresAt,
  };
}

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const userId = (sp.get('userId') || '').trim();
  const email = (sp.get('email') || '').trim();
  const q = (sp.get('q') || '').trim();

  // 订单查询（补单前核对用）：q 优先按我方订单 ID，再按渠道订单号
  if (q) {
    const order = await prisma.rechargeOrder.findUnique({ where: { id: q } })
      ?? await prisma.rechargeOrder.findUnique({ where: { providerOrderId: q } });
    if (!order) return NextResponse.json({ ok: false, error: '订单不存在' }, { status: 404 });
    return NextResponse.json({ ok: true, order: orderRow(order) });
  }

  // 用户查询
  if (!userId && !email) {
    return NextResponse.json({ ok: false, error: '缺少 userId 或 email' }, { status: 400 });
  }
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (!user) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });

  const [balance, ledger, orders] = await Promise.all([
    getBalance(user.id),
    prisma.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.rechargeOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  return NextResponse.json({
    ok: true,
    operator: identity.operator,
    user: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt },
    balance,
    ledger: ledger.map((l) => ({
      id: l.id,
      type: l.type,
      amount: l.amount,
      jobId: l.jobId,
      description: l.description,
      createdAt: l.createdAt,
    })),
    orders: orders.map(orderRow),
  });
}

export async function POST(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'refund') return handleRefund(req, identity, body);
  if (action === 'complete_order') return handleCompleteOrder(req, identity, body);
  return NextResponse.json({ ok: false, error: '未知操作' }, { status: 400 });
}

/** 退款：engine.refund（增加可用余额 + REFUND Ledger；关联 jobId/orderId 时同步标记任务 refunded） */
async function handleRefund(req: NextRequest, identity: OpsIdentity, body: any): Promise<NextResponse> {
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const amount = Math.round(Number(body.amount));
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const jobId = typeof body.jobId === 'string' && body.jobId.trim() ? body.jobId.trim() : '';
  const orderId = typeof body.orderId === 'string' && body.orderId.trim() ? body.orderId.trim() : '';

  if (!userId && !email) return NextResponse.json({ ok: false, error: '缺少 userId 或 email' }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 1 || amount > MAX_REFUND) {
    return NextResponse.json({ ok: false, error: `退款积分必须是 1~${MAX_REFUND} 的整数` }, { status: 400 });
  }
  if (reason.length < 2) return NextResponse.json({ ok: false, error: '必须填写退款原因（至少 2 字）' }, { status: 400 });
  if (body.confirmed !== true) return NextResponse.json({ ok: false, error: '请先确认退款金额与原因' }, { status: 400 });

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (!user) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });

  // 写操作限流（同一 operator 10 分钟内最多 20 次退款）
  const rl = await checkOpsRateLimit(identity.operator, 'credit_refund', 20);
  if (!rl.ok) return NextResponse.json({ ok: false, error: '操作过于频繁，请稍后再试' }, { status: 429 });

  // 超过当前可用余额的退款必须挂关联（任务号/订单号），防止无依据发放积分
  const balance = await getBalance(user.id);
  if (amount > balance.available && !jobId && !orderId) {
    return NextResponse.json({
      ok: false,
      error: '退款金额超过当前可用余额，请填写关联任务号或订单号以核实退款来源',
    }, { status: 400 });
  }

  const r = await refund({
    userId: user.id,
    jobId: jobId || orderId || `manual:${user.id}`,
    amount,
    reason,
    idempotencyKey: `admin_refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    metadata: {
      operator: identity.operator,
      adminId: identity.kind === 'admin' ? identity.userId : null,
      orderId: orderId || null,
    },
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: '退款失败：' + r.error }, { status: 400 });

  await logAdminAction({
    identity,
    action: 'credit_refund',
    targetId: user.id,
    batchId: null, // 同一用户可多次退款；AdminLog [action,batchId] 唯一，batchId 置 null 避免冲突
    params: { amount, reason, jobId: jobId || null, orderId: orderId || null },
    result: { refunded: r.refunded },
    ip: clientIp(req),
  });

  const after = await getBalance(user.id);
  return NextResponse.json({ ok: true, refunded: r.refunded, balance: after });
}

/**
 * 补单：仅限真实已收款未到账订单。
 * 校验清单（全部通过才放行 grantRechargeOrder）：
 *  1. 订单存在（我方订单 ID 或渠道订单号查得）
 *  2. 我方订单已记录 providerOrderId（未记录 = 无法核实收款，禁止补单）
 *  3. 填写的渠道订单号与订单记录完全一致（防跨单到账 / 填错号）
 *  4. 订单非 cancelled（已取消/已退款永不到账）
 *  5. grantRechargeOrder 内部幂等（grant 用 recharge:{orderId}:{purchased|bonus} 键；already 直接返回）
 *  6. allowExpired=true：渠道已收款但我方订单因 15 分钟有效期已 expired 时仍可到账（真实收款场景）
 *  7. 审计写 AdminLog（[action,batchId] 唯一，同一订单重复补单不重复记审计）
 */
async function handleCompleteOrder(req: NextRequest, identity: OpsIdentity, body: any): Promise<NextResponse> {
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const providerOrderId = typeof body.providerOrderId === 'string' ? body.providerOrderId.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!orderId && !providerOrderId) return NextResponse.json({ ok: false, error: '缺少订单号或渠道订单号' }, { status: 400 });
  if (!providerOrderId) return NextResponse.json({ ok: false, error: '必须填写渠道订单号（用于核实已收款）' }, { status: 400 });
  if (note.length < 2) return NextResponse.json({ ok: false, error: '必须填写补单说明（至少 2 字）' }, { status: 400 });
  if (body.confirmed !== true) return NextResponse.json({ ok: false, error: '请先勾选「已核实渠道收款」' }, { status: 400 });

  // 1) 查单：优先我方订单 ID，其次渠道订单号
  const order = orderId
    ? await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
    : await prisma.rechargeOrder.findUnique({ where: { providerOrderId } });
  if (!order) return NextResponse.json({ ok: false, error: '订单不存在' }, { status: 404 });

  // 2) 我方订单必须已记录渠道订单号
  if (!order.providerOrderId) {
    return NextResponse.json({ ok: false, error: '订单未记录渠道订单号，无法核实收款，禁止补单' }, { status: 400 });
  }
  // 3) 渠道订单号必须与订单记录完全一致
  if (order.providerOrderId !== providerOrderId) {
    return NextResponse.json({ ok: false, error: '渠道订单号与订单记录不一致，拒绝补单' }, { status: 400 });
  }
  // 4) 已取消订单永不到账
  if (order.status === 'cancelled') {
    return NextResponse.json({ ok: false, error: '订单已取消，禁止补单' }, { status: 400 });
  }

  // 写操作限流（同一 operator 10 分钟内最多 20 次补单）
  const rl = await checkOpsRateLimit(identity.operator, 'recharge_order_complete', 20);
  if (!rl.ok) return NextResponse.json({ ok: false, error: '操作过于频繁，请稍后再试' }, { status: 429 });

  // 5) 到账（幂等：granted 订单直接 already 返回）
  const result = await grantRechargeOrder(order.id, {
    allowExpired: true,
    expectedProviderOrderId: providerOrderId,
  });
  if (!result.ok) {
    const map: Record<string, string> = {
      not_found: '订单不存在',
      invalid_state: '订单当前状态不可补单（已取消/已退款）',
      provider_order_mismatch: '渠道订单号与订单记录不一致，拒绝补单',
      grant_error: '积分到账失败，请稍后重试（不会重复到账）',
    };
    return NextResponse.json({ ok: false, error: map[result.error ?? ''] || '补单失败' }, { status: 400 });
  }

  // 7) 审计（同一订单重复补单 → P2002 幂等跳过）
  try {
    await logAdminAction({
      identity,
      action: 'recharge_order_complete',
      targetId: order.userId,
      batchId: order.id,
      params: { providerOrderId, note, confirmed: true },
      result: { status: 'granted', granted: result.granted, already: !!result.already },
      ip: clientIp(req),
    });
  } catch (e: any) {
    if (e?.code !== 'P2002') console.error('[payments] audit log failed:', e?.message || e);
  }

  return NextResponse.json({
    ok: true,
    already: !!result.already,
    granted: result.granted,
    order: { id: order.id, status: 'granted', planName: order.planName },
  });
}
