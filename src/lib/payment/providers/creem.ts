/**
 * Creem 渠道（Merchant of Record，3.9% + $0.40，无月费，处理全球税务）
 * 真实接入需环境变量：
 *   CREEM_API_KEY           —— API Key（Creem Dashboard → Settings → API Keys）
 *   CREEM_PRODUCT_ID        —— 商品 Product ID（或按 planCode 映射多 product）
 *   CREEM_WEBHOOK_SECRET    —— Webhook 验签密钥（Dashboard → Developers → Webhook）
 *
 * API：POST https://api.creem.io/v1/checkouts
 *   headers: { x-api-key: <API_KEY>, Content-Type: application/json }
 *   body: { product_id, custom_data:{ orderId }, customer:{ email } } → 返回 checkout_url
 * Webhook 验签：creem-signature = HMAC-SHA256(secret, rawBody) hex
 * 支付成功事件：checkout.completed（status=paid，以官方文档为准）
 */
import { PaymentProvider, CreateCheckoutInput, CreateCheckoutResult, WebhookVerifyResult } from '../types';

export const creemProvider: PaymentProvider = {
  code: 'creem',
  displayName: 'Creem',
  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    throw new Error('Creem 接入待配置：需 CREEM_API_KEY / PRODUCT_ID / WEBHOOK_SECRET');
  },
  async verifyWebhook(): Promise<WebhookVerifyResult> {
    throw new Error('Creem webhook 验签待配置');
  },
};
