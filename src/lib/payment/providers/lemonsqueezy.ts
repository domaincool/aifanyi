/**
 * Lemon Squeezy 渠道（Merchant of Record，处理全球税务）
 * 真实接入需环境变量：
 *   LEMONSQUEEZY_API_KEY          —— API Key
 *   LEMONSQUEEZY_STORE_ID         —— Store ID
 *   LEMONSQUEEZY_VARIANT_ID       —— 商品 Variant ID（或按 planCode 映射多 variant）
 *   LEMONSQUEEZY_WEBHOOK_SECRET   —— Webhook 验签密钥
 *
 * API：POST https://api.lemonsqueezy.com/v1/checkouts
 *   headers: { Authorization: Bearer <API_KEY>, Accept: application/vnd.api+json, Content-Type: application/vnd.api+json }
 *   body: data.type=checkouts, data.attributes.{ store_id, variant_id, custom_price, checkout_data.custom.{ orderId }, checkout_data.email }
 * Webhook 验签：X-Signature = HMAC-SHA256(secret, rawBody) hex
 * 支付成功事件：order_created + subscription 无 / 一次性 → order_paid 或 order_created（status=paid）
 */
import { PaymentProvider, CreateCheckoutInput, CreateCheckoutResult, WebhookVerifyResult } from '../types';

export const lemonSqueezyProvider: PaymentProvider = {
  code: 'lemonsqueezy',
  displayName: 'Lemon Squeezy',
  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    throw new Error('Lemon Squeezy 接入待配置：需 LEMONSQUEEZY_API_KEY / STORE_ID / VARIANT_ID / WEBHOOK_SECRET');
  },
  async verifyWebhook(): Promise<WebhookVerifyResult> {
    throw new Error('Lemon Squeezy webhook 验签待配置');
  },
};
