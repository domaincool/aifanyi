/**
 * Credit System · 定价规则
 * PricingRule 表驱动：feature → unit → creditRate → min/maxCharge → version
 * 前端永不计算价格；estimate 供「预计消耗」提示使用（服务端算价）
 */
import { prisma } from '../db';
import { Feature } from './types';

const RULE_CACHE = new Map<string, { rule: any; at: number }>();
const CACHE_TTL = 60_000; // 60s 缓存，调价秒级生效

/** 取某 feature 当前生效定价规则（版本 = 该 feature 最高 active version） */
export async function getActivePricingRule(feature: Feature): Promise<any | null> {
  const cacheKey = feature;
  const hit = RULE_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.rule;

  const rule = await prisma.pricingRule.findFirst({
    where: { feature, active: true },
    orderBy: { version: 'desc' },
  });
  RULE_CACHE.set(cacheKey, { rule, at: Date.now() });
  return rule;
}

export function clearPricingCache(): void {
  RULE_CACHE.clear();
}

/**
 * 按特征量预估额度消耗
 * @param feature 功能
 * @param units 特征量（页数/千字符/张数/分钟…，由调用方按 feature 语义传入）
 * @returns 预估 credits（已 clamp min/maxCharge），无规则时返回 null（= 免费）
 */
export async function estimateCredits(feature: Feature, units: number): Promise<{ credits: number; ruleVersion: number } | null> {
  const rule = await getActivePricingRule(feature);
  if (!rule) return null; // 无定价 = 免费功能（如盲测）
  // creditRate 定义为「每 unit 的 credit」
  let credits = Math.max(1, Math.round(units * rule.creditRate));
  if (rule.minCharge && credits < rule.minCharge) credits = rule.minCharge;
  if (rule.maxCharge && credits > rule.maxCharge) credits = rule.maxCharge;
  return { credits, ruleVersion: rule.version };
}

/** 特征量换算辅助（业务层用）：把业务量转成 PricingRule.unit 的倍数 */
export function charsToUnits(chars: number): number {
  return Math.ceil(chars / 1000); // per_1000_chars
}

export function pagesToUnits(pages: number): number {
  return pages; // per_page
}

export function imagesToUnits(count: number): number {
  return count; // per_image
}

export function secondsToUnits(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60)); // per_minute
}
