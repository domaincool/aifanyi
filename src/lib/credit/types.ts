/**
 * Credit System · 类型定义
 * 设计原则：后台复杂、前台简单。这些类型只存在于服务端。
 */

/** 额度流转类型（CreditLedger.type） */
export const LEDGER_TYPES = {
  RESERVE: 'reserve',
  CONSUME: 'consume',
  RELEASE: 'release',
  REFUND: 'refund',
  GRANT: 'grant',
  EXPIRE: 'expire',
  ADMIN_ADJUST: 'admin_adjust',
} as const;
export type LedgerType = (typeof LEDGER_TYPES)[keyof typeof LEDGER_TYPES];

/** CreditGrant.type 来源批次 */
export const GRANT_TYPES = {
  FREE_MONTHLY: 'FREE_MONTHLY',
  BONUS: 'BONUS',
  SUBSCRIPTION: 'SUBSCRIPTION',
  PURCHASED: 'PURCHASED',
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT',
  REFUND: 'REFUND',
} as const;
export type GrantType = (typeof GRANT_TYPES)[keyof typeof GRANT_TYPES];

/** 功能标识（UsageRecord.feature + PricingRule.feature） */
export const FEATURES = {
  TEXT: 'text_translation',
  PDF: 'pdf_translation',
  IMAGE: 'image_translation',
  SUBTITLE: 'subtitle_translation',
  DOC: 'doc_translation',
  WEB: 'web_translation',
  POLISH: 'polish',
  BLINDTEST: 'blindtest',
  STT: 'speech_to_text',
  TTS: 'text_to_speech',
} as const;
export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

/** UsageRecord 状态 */
export const USAGE_STATUS = {
  RESERVED: 'reserved',
  CONSUMED: 'consumed',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  PARTIAL: 'partial',
} as const;

/** Job 的 credit 结算状态 */
export const JOB_CREDIT_STATE = {
  RESERVED: 'reserved',
  CONSUMED: 'consumed',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  SETTLED: 'credit_settled',
} as const;
export type JobCreditState = (typeof JOB_CREDIT_STATE)[keyof typeof JOB_CREDIT_STATE];

export interface ReserveInput {
  userId: string;
  jobId: string;
  feature: Feature;
  estimatedCredits: number;
  idempotencyKey: string; // `${jobId}:reserve`
  metadata?: Record<string, unknown>;
}

export interface ConsumeInput {
  userId: string;
  jobId: string;
  usageId: string;
  actualCredits: number;
  idempotencyKey: string; // `${jobId}:consume`
  metadata?: Record<string, unknown>;
}

export interface ReleaseInput {
  userId: string;
  jobId: string;
  usageId: string;
  amount: number; // 退回的预留额度
  idempotencyKey: string; // `${jobId}:release`
  metadata?: Record<string, unknown>;
}

export interface RefundInput {
  userId: string;
  jobId: string;
  amount: number;
  reason: string;
  idempotencyKey: string; // `${jobId}:refund`
  metadata?: Record<string, unknown>;
}

export interface GrantInput {
  userId: string;
  type: GrantType;
  source: string; // 中文来源描述，如「注册赠送」
  amount: number;
  expiresAt?: Date | null;
  adminId?: string | null;
  reason?: string;
  idempotencyKey: string; // `grant:${uuid}`
}

export interface CreditBalance {
  available: number;
  reserved: number;
  total: number;
}
