/**
 * 支付渠道抽象层类型
 * 支持 mock / lemonsqueezy / paddle / creem，未来可扩展 wechat / alipay / stripe
 * 换渠道 = 换 provider 实现 + 改 PAYMENT_PROVIDER 环境变量，不动业务代码
 */

export type PaymentProviderCode = 'mock' | 'lemonsqueezy' | 'paddle' | 'creem';

export interface CreateCheckoutInput {
  orderId: string;
  planCode: string;
  planName: string;
  /** 人民币分（定价基准；真实渠道按汇率换算为渠道货币） */
  priceCents: number;
  purchasedCredits: number;
  bonusCredits: number;
  userId: string;
  email: string;
}

export interface CreateCheckoutResult {
  /** 用户跳转支付的 URL；mock 模式为空字符串 */
  checkoutUrl: string;
  /** 渠道 checkout/order id */
  providerOrderId?: string;
  /** 是否模拟支付（前端据此走 confirm 而非跳转） */
  mock?: boolean;
}

export interface WebhookVerifyResult {
  valid: boolean;
  /** 我方订单 id（从渠道 custom data / metadata 还原） */
  orderId: string;
  /** 渠道订单 id */
  providerOrderId: string;
  /** 渠道事件名 */
  event: string;
  /** 是否支付成功 */
  paid: boolean;
  /** 实付金额（渠道货币最小单位） */
  amountCents?: number;
  /** 校验失败原因 */
  reason?: string;
}

export interface PaymentProvider {
  code: PaymentProviderCode;
  displayName: string;
  /** 创建支付会话（返回 checkout 跳转 URL） */
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /** 验证并解析 webhook 回调（验签 + 事件解析） */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<WebhookVerifyResult>;
}
