# 10 · 安全清单（Security Checklist）

## 认证与会话

- [x] SESSION_SECRET ≥32 字符强随机，缺失即拒绝服务（fail-fast）
- [x] Cookie：HttpOnly + Secure + SameSite=Lax
- [x] 无 localStorage 长期 token；无 refresh token 依赖
- [x] Session 30 天过期 + revokedAt 可撤销（validateSession 校验）
- [x] 登录后写 lastUsedAt（设备活跃审计）

## OAuth

- [x] state 参数防 CSRF（32B 随机，httpOnly cookie，一次性）
- [x] id_token 验签（tokeninfo：aud/iss/email_verified）
- [x] 最小 scope（openid email profile），不申请敏感权限
- [x] 生产 client 仅生产 redirect URI
- [x] 应用已发布 In production（无测试模式漏洞）

## 账户合并

- [x] 仅基于 verified email 合并（Google 侧 email_verified + 本侧 OTP 验证）
- [x] 绝不因未验证字符串自动合并

## 资源所有权

- [x] 所有资源 API 强制 ownership 检查（不匹配 404，不泄露存在性）
- [x] 前端隐藏按钮不承担安全职责

## 防滥用

- [x] OTP：attempts≤5 / 10min 过期 / 60s 冷却 / IP+email 限流
- [x] 登录类接口通用限流（滑动窗口，每小时清理）
- [x] 验证码哈希存储（tokenHash）

## 数据生命周期

- [x] 删除账户：级联 + 手动清理全部关联数据
- [x] PDF 文档 24h 惰性清理（既有）
- [x] 隐私政策/服务条款页面上线

## 已知边界（透明声明）

- [ ] SMTP 未配置：email OTP 暂不可用（Google 登录可用）
- [ ] 内存限流：多实例需换 Redis（当前单实例）
- [ ] ipHash/userAgentHash 已落库，展示层待补（审计用途）
