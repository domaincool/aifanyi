/**
 * Creem 渠道（Merchant of Record，3.9% + $0.40，无月费，处理全球税务）
 * 环境变量：
 *   CREEM_API_KEY            —— API Key（Dashboard → Developers → API Keys）
 *   CREEM_WEBHOOK_SECRET     —— Webhook 验签密钥（Dashboard → Developers → Webhook）
 *   CREEM_PRODUCT_STARTER    —— 入门包商品 Product ID
 *   CREEM_PRODUCT_STANDARD   —— 主力包商品 Product ID
 *   CREEM_PRODUCT_PRO        —— 重度包商品 Product ID
 *   （或 CREEM_PRODUCT_MAP    —— JSON 映射 {"starter":"prod_x","standard":"prod_y","pro":"prod_z"}）
 *   CREEM_SUCCESS_URL        —— 支付成功跳转（可选，默认 https://aifanyi.com/credit）
 *
 * API：POST https://api.creem.io/v1/checkouts（测试 https://test-api.creem.io/v1，按 key 前缀 creem_test_ 自动切换）
 *   headers: { x-api-key, Content-Type: application/json }
 *   body: { product_id, request_id, customer:{email}, metadata:{orderId,planCode,userId}, success_url }
 *   → { id, checkout_url, status }
 * Webhook 验签：creem-signature = HMAC-SHA256(secret, rawBody) hex
 * 支付成功事件：checkout.completed（object.status=completed / object.order.status=paid）
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentProvider, CreateCheckoutInput, CreateCheckoutResult, WebhookVerifyResult } from '../types';

const PROD_BASE = 'https://api.creem.io/v1';
const TEST_BASE = 'https://test-api.creem.io/v1';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Creem 未配置 ${name}`);
  return v;
}

function apiBase(): string {
  const key = process.env.CREEM_API_KEY || '';
  return key.startsWith('creem_test_') ? TEST_BASE : PROD_BASE;
}

function getProductId(planCode: string): string {
  // 优先 JSON 映射
  const mapRaw = process.env.CREEM_PRODUCT_MAP;
  if (mapRaw) {
    try {
      const map = JSON.parse(mapRaw);
      if (typeof map[planCode] === 'string' && map[planCode]) return map[planCode];
    } catch {
      /* 忽略非法 JSON，走单独变量 */
    }
  }
  const byPlan = process.env['CREEM_PRODUCT_' + planCode.toUpperCase()];
  if (byPlan) return byPlan;
  const single = process.env.CREEM_PRODUCT_ID;
  if (single) return single;
  throw new Error(`Creem 未配置 planCode=${planCode} 的商品 ID（CREEM_PRODUCT_${planCode.toUpperCase()} 或 CREEM_PRODUCT_MAP）`);
}

export const creemProvider: PaymentProvider = {
  code: 'creem',
  displayName: 'Creem',
  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const apiKey = requireEnv('CREEM_API_KEY');
    const productId = getProductId(input.planCode);
    const body: Record<string, unknown> = {
      product_id: productId,
      request_id: input.orderId, // 幂等键 = 我方订单 id，防重复下单
      customer: { email: input.email },
      metadata: { orderId: input.orderId, planCode: input.planCode, userId: input.userId },
      success_url: process.env.CREEM_SUCCESS_URL || 'https://aifanyi.com/credit',
    };
    const res = await fetch(apiBase() + '/checkouts', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Creem 下单失败（${res.status}）：${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.checkout_url) throw new Error('Creem 未返回 checkout_url');
    return { checkoutUrl: data.checkout_url, providerOrderId: data.id };
  },

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<WebhookVerifyResult> {
    const secret = requireEnv('CREEM_WEBHOOK_SECRET');
    const sig = headers['creem-signature'];
    if (!sig) {
      return { valid: false, orderId: '', providerOrderId: '', event: '', paid: false, reason: '缺少 creem-signature' };
    }
    const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(computed);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, orderId: '', providerOrderId: '', event: '', paid: false, reason: '签名不匹配' };
    }
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, orderId: '', providerOrderId: '', event: '', paid: false, reason: 'payload 非 JSON' };
    }
    const eventType: string = payload.eventType || payload.type || '';
    const obj = payload.object || payload.data || {};
    const order = obj.order || {};
    const orderId: string = (obj.metadata && obj.metadata.orderId) || obj.request_id || '';
    const paid = eventType === 'checkout.completed' && (obj.status === 'completed' || order.status === 'paid');
    const amountCents = typeof order.amount === 'number' ? order.amount : undefined;
    return {
      valid: true,
      orderId,
      providerOrderId: obj.id || order.id || '',
      event: eventType,
      paid,
      amountCents,
    };
  },
};
