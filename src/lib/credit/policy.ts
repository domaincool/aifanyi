/**
 * Credit System · 消费策略（Credit Consumption Policy）
 * 消费顺序：即将过期 → 免费/月度 → Bonus → 永久购买（可配置，不硬编码在引擎）
 * 实现为 grants 排序规则；未来调整只需改这里
 */
import { Prisma } from '@prisma/client';

/** 批次类型优先级：数字越小越先消费（在「先过期」之后作为次级排序） */
export const GRANT_TYPE_PRIORITY: Record<string, number> = {
  FREE_MONTHLY: 1, // 免费/月度额度先消费
  FREE_GRANT: 1, // 注册赠送（新用户体验额度）先消费
  BONUS: 2, // 充值赠送
  SUBSCRIPTION: 3,
  PURCHASED: 4, // 购买的永久额度最后消费
  REFUND: 5,
  ADMIN_ADJUSTMENT: 6,
};

/**
 * 生成「先消费谁」的排序条件：
 * 1. 未过期的优先（expiresAt 有值且未到期）
 * 2. 到期时间近的优先（ASC；null = 永久额度排最后）
 * 3. 同到期时间按 type 优先级
 */
export function grantOrderBy(): Prisma.CreditGrantOrderByWithRelationInput[] {
  return [
    // expiresAt ASC（null 排最后 —— PostgreSQL NULLS LAST）
    { expiresAt: 'asc' },
  ];
}

/** 在内存中对已取出的 grants 做精确排序（含 type 优先级） */
export function sortGrantsForConsumption(grants: { id: string; type: string; expiresAt: Date | null; remainingAmount: number; reservedAmount?: number }[]): { id: string; type: string; expiresAt: Date | null; remainingAmount: number; reservedAmount?: number }[] {
  return [...grants].sort((a, b) => {
    // 1) 有过期时间的排前面（更紧迫）
    if (a.expiresAt && !b.expiresAt) return -1;
    if (!a.expiresAt && b.expiresAt) return 1;
    // 2) 过期时间近的优先
    if (a.expiresAt && b.expiresAt && a.expiresAt.getTime() !== b.expiresAt.getTime()) {
      return a.expiresAt.getTime() - b.expiresAt.getTime();
    }
    // 3) 类型优先级
    return (GRANT_TYPE_PRIORITY[a.type] ?? 99) - (GRANT_TYPE_PRIORITY[b.type] ?? 99);
  });
}
