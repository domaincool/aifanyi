# 06 · 最小权限 Scope 说明

## 申请范围

```
openid email profile
```

| Scope | 用途 | 敏感度 |
|-------|------|--------|
| openid | OIDC 认证（id_token） | 非敏感 |
| email | 获取已验证邮箱（账户合并依据） | 非敏感 |
| profile | 昵称/头像展示 | 非敏感 |

## 明确不申请

- ❌ Drive / Gmail / Calendar / Contacts（Google 翻译走自有 API Key，与 OAuth 无关）
- ❌ 任何敏感 scope → 不触发「未验证应用」审核流程
- ❌ refresh_token（access_type=online，业务仅需身份；网站登录态由自有 Session 维持）

## 原则

1. Google OAuth 仅作 Authentication Provider，不是账户系统
2. 数据库 User 不直接依赖 Google（AuthIdentity 解耦，未来可加 Apple/微信）
3. 登录态 = 自有 HttpOnly Session（30 天），Google 失效不影响已登录用户
