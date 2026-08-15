/**
 * 支付 provider 工厂：按 PAYMENT_PROVIDER 环境变量选择渠道
 * - 开发/测试：默认 mock（模拟支付，确认即到账，仅本地 E2E）
 * - 生产环境：未配置真实渠道（或 mock）时返回 disabled，下单即报错，杜绝「点购买直接到账」
 * - 显式 PAYMENT_MOCK_ENABLED=true 可临时放开 mock（E2E/调试）
 */
import { PaymentProvider } from './types';
import { mockProvider } from './providers/mock';
import { lemonSqueezyProvider } from './providers/lemonsqueezy';
import { paddleProvider } from './providers/paddle';
import { creemProvider } from './providers/creem';

/** 支付未配置/禁用：createCheckout 直接 throw，confirm/webhook 均不到账 */
const disabledProvider: PaymentProvider = {
  code: 'disabled',
  displayName: '支付未开通',
  async createCheckout() {
    throw new Error('支付渠道暂未开通，暂不支持充值。');
  },
  async verifyWebhook() {
    return { valid: false, orderId: '', providerOrderId: '', event: '', paid: false, reason: '支付渠道未配置' };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const code = (process.env.PAYMENT_PROVIDER || '').toLowerCase();
  const isProd = process.env.NODE_ENV === 'production';
  const mockAllowed = process.env.PAYMENT_MOCK_ENABLED === 'true';

  switch (code) {
    case 'lemonsqueezy':
      return lemonSqueezyProvider;
    case 'paddle':
      return paddleProvider;
    case 'creem':
      return creemProvider;
    case 'mock':
      // mock 仅限非生产环境，或显式 PAYMENT_MOCK_ENABLED=true（E2E/调试）
      return mockAllowed || !isProd ? mockProvider : disabledProvider;
    default:
      // 未配置渠道：开发环境默认 mock；生产环境一律禁用（安全底线）
      return mockAllowed || !isProd ? mockProvider : disabledProvider;
  }
}

export * from './types';
