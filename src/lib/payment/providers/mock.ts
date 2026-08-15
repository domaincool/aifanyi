/**
 * 模拟支付 provider（开发/测试 + 真实渠道未接入时的兜底）
 * 流程：purchase 返回 mock:true → 前端调 confirm → grant
 */
import { PaymentProvider, CreateCheckoutInput, CreateCheckoutResult, WebhookVerifyResult } from '../types';

export const mockProvider: PaymentProvider = {
  code: 'mock',
  displayName: '模拟支付',
  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    return { checkoutUrl: '', mock: true };
  },
  async verifyWebhook(): Promise<WebhookVerifyResult> {
    return { valid: false, orderId: '', providerOrderId: '', event: '', paid: false, reason: 'mock 无 webhook' };
  },
};
