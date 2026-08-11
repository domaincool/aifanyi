# 12 · 上线清单（Launch Checklist）

## 已就绪

- [x] Google OAuth Production 发布（正式版，无测试用户限制）
- [x] 隐私政策 / 服务条款页面上线
- [x] 生产 OAuth client 仅含生产 redirect URI
- [x] 强随机 SESSION_SECRET（本地+服务器）
- [x] 26 项验收测试全绿
- [x] 全套安全修复上线（Phase 0-5）

## 上线前待办

- [ ] **配置 SMTP**（腾讯/阿里企业邮等）：启用 email OTP 登录通道
  - 配置后实测：发送验证码 → 收件 → 校验 → 登录
- [ ] 更换生产邮箱：确认支持邮箱/通知邮箱为正式运营邮箱（当前 domaincool@gmail.com）
- [ ] 监控接入：错误日志告警（Google 登录失败率、OTP 发送量）
- [ ] 观察期（1-2 周）：确认无异常后再移除任何测试遗留数据
- [ ] 多实例部署前：将内存限流替换为 Redis（如扩容）

## 运营建议

- 数据看板：登录渠道占比（Google vs Email）、注册转化、设备数
- 每周安全快照：异常登录、限流触发次数、删除账户数
- Google Console 定期检查：client 状态、无未解决警告
