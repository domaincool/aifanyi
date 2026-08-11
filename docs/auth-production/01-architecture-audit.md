# 01 · 认证架构审计报告（最终版）

> 项目：aifanyi.com 用户系统 Production Authentication Architecture Redesign
> 审计日期：2026-08-11 → 2026-08-12（全部修复已验证上线）

## 审计结论

原认证体系为 Google OAuth Testing 模式的临时方案，存在 **4 个 P0 级安全漏洞** 与多项架构级问题。经 Phase 0-6 改造，全部修复并验收通过。

## 原始问题清单与修复状态

| # | 级别 | 问题 | 修复 | 状态 |
|---|------|------|------|------|
| P0-1 | 严重 | SESSION_SECRET 为空 → JWT 空密钥 HS256 可伪造 session | 强随机 64B 密钥 + 代码 fail-fast（<32 字符拒绝） | ✅ 已上线 |
| P0-2 | 严重 | GET /api/pdf/tasks/:taskId 无 ownership 检查 | 校验 userId/guestSessionId 不匹配返 404 | ✅ 已上线 |
| P0-3 | 高 | OAuth 无 state 参数 → Login CSRF / Code Injection | 32B 随机 state 存 httpOnly cookie，callback 校验+清除 | ✅ 已上线 |
| P0-4 | 高 | id_token 只 base64 解码未验签 | tokeninfo 端点校验 aud/iss/email_verified | ✅ 已上线 |
| P1-1 | 高 | 用户表直接依赖 Google（authProvider 单值） | AuthIdentity(provider+providerAccountId) 多身份模型 | ✅ 已上线 |
| P1-2 | 中 | Session 无可撤销/审计字段 | lastUsedAt/ipHash/userAgentHash/revokedAt | ✅ 已上线 |
| P1-3 | 中 | 验证码无尝试次数上限 | attempts 5 次上限 | ✅ 已上线 |
| P1-4 | 中 | 验证码无发送冷却 | 60s 冷却 | ✅ 已上线 |
| P2-1 | 高 | Google OAuth Testing 模式（100 用户上限） | 应用已发布 In production（正式版） | ✅ 已发布 |
| P2-2 | 高 | Client ID 抄录错误导致 invalid_client | 从控制台详情页精确复制，token 端点验证有效 | ✅ 已修复 |
| P3-1 | 中 | OTP 无 IP 维度限流 | send 5次/h/IP + 3次/h/邮箱；verify 20次/h/IP | ✅ 已上线 |
| P4-1 | 中 | 无设备管理 | devices 列表/单设备退出/退出全部 | ✅ 已上线 |
| P4-2 | 中 | 无删除账户 | DELETE /api/account 级联删除 | ✅ 已上线 |
| P5-1 | 低 | 登录相关接口无通用限流 | 内存滑动窗口限流器 | ✅ 已上线 |
| P6-1 | 低 | 无验收测试 | 26 项全链路验收全绿 | ✅ 已完成 |

## 遗留说明

- SMTP 未配置：email OTP 发送返回失败（不打印验证码，安全优先）。配置 SMTP 后即启用邮件验证码。
- 多实例部署时内存限流需替换为 Redis（当前单 PM2 实例）。
