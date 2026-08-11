# 07 · Google OAuth Verification 状态判断

## 当前状态：无需 Google Verification 审核

| 判断维度 | 值 | 结论 |
|----------|-----|------|
| 用户类型 | External | 公开用户需发布 |
| Scope | openid/email/profile（非敏感） | ✅ 不触发审核 |
| 品牌信息 | 首页/隐私政策/服务条款完整 | ✅ 不触发审核 |
| 发布状态 | In production | ✅ 已生效 |
| 测试用户限制 | 已移除（正式版） | ✅ |

## 何时会需要 Verification

- 申请敏感 scope（Gmail 读写、Drive 等）
- 使用受限 scope（部分 Google API）
- 应用出现安全合规风险提示

当前架构**刻意避开**这些触发条件：认证只用非敏感 scope，翻译能力走自有 API Key。

## 监控建议

- Google Cloud Console → Security 定期检查无警告
- 若未来申请敏感 scope，需走 Verification 流程（约 3-5 工作日审核）
