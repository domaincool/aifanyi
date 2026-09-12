/**
 * 积分扣费总开关（公平使用制改造 B1，2026-09-01 用户拍板）
 *
 * CREDIT_DEDUCTION=on  → 恢复旧行为：翻译扣积分、余额不足拦截、失败退款
 * CREDIT_DEDUCTION=off（默认）→ 积分扣费暂停：翻译成功不扣分、不产生余额不足拦截；
 *                               注册赠送照发；失败退款逻辑空转（无预留可退）
 * 切换即时生效（每次请求读 env，无需重启可感知；部署侧 env 变更后需重启进程）
 */
export function isCreditDeductionEnabled(): boolean {
  return process.env.CREDIT_DEDUCTION === 'on';
}

/** 免费区（flag off）时后端余额不足拦截文案；扣费关闭时不渲染任何提示（保持空串，仅保留导出名与类型） */
export const FAIR_USE_PAUSED_MSG = '';
