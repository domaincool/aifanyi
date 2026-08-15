/**
 * 支付 provider 工厂：按 PAYMENT_PROVIDER 环境变量选择渠道
 * 默认 mock（开发/测试）；生产切 lemonsqueezy / paddle / creem
 */
import { PaymentProvider } from './types';
import { mockProvider } from './providers/mock';
import { lemonSqueezyProvider } from './providers/lemonsqueezy';
import { paddleProvider } from './providers/paddle';
import { creemProvider } from './providers/creem';

export function getPaymentProvider(): PaymentProvider {
  const code = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  switch (code) {
    case 'lemonsqueezy':
      return lemonSqueezyProvider;
    case 'paddle':
      return paddleProvider;
    case 'creem':
      return creemProvider;
    default:
      return mockProvider;
  }
}

export * from './types';
