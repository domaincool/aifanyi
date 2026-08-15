/**
 * Paddle 渠道（Merchant of Record，独立公司，数字商品/订阅成熟）
 * 真实接入需环境变量：
 *   PADDLE_API_KEY          —— API Key（创建 checkout）
 *   PADDLE_PRICE_ID         —— 商品 Price ID（或按 planCode 映射多 price）
 *   PADDLE_WEBHOOK_SECRET   —— Webhook 验签密钥（对称验证用）
 *   PADDLE_PUBLIC_KEY       —— Webhook 公钥（p_signature RSA 验签，Paddle 推荐）
 *
 * API：POST https://api.paddle.com/checkouts（v2）
 *   body: { items:[{ priceId, quantity:1 }], customData:{ orderId }, customer:{ email } }
 * Webhook 验签：p_signature（RSA-SHA1，用公钥验证）或按 secret 对称验证
 * 支付成功事件：checkout.completed / transaction.completed（status=completed）
 */
import { PaymentProvider, CreateCheckoutInput, CreateCheckoutResult, WebhookVerifyResult } from '../types';

export const paddleProvider: PaymentProvider = {
  code: 'paddle',
  displayName: 'Paddle',
  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    throw new Error('Paddle 接入待配置：需 PADDLE_API_KEY / PRICE_ID / WEBHOOK_SECRET');
  },
  async verifyWebhook(): Promise<WebhookVerifyResult> {
    throw new Error('Paddle webhook 验签待配置');
  },
};
