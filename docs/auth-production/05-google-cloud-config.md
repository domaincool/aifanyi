# 05 · Google Cloud 配置

## 项目

- 项目 ID：**aifanyi-503407**
- 项目名称：aifanyi

## OAuth 同意屏幕（Consent Screen）

| 配置项 | 值 |
|--------|-----|
| 用户类型 | **External → 已发布（In production，正式版）** |
| 应用名称 | 爱翻译 aifanyi.com |
| 支持邮箱 | domaincool@gmail.com |
| 应用首页 | https://aifanyi.com |
| 应用隐私政策 | https://aifanyi.com/privacy |
| 应用服务条款 | https://aifanyi.com/terms |
| 授权域 | aifanyi.com |
| Scope | openid / email / profile（非敏感） |

> 发布状态：2026-08-11 由 Testing 发布为 In production。任意 Google 用户可登录，100 测试用户上限已移除。

## OAuth 客户端

| 配置项 | 值 |
|--------|-----|
| 类型 | Web 应用 |
| 名称 | aifanyi.com 登录 |
| Client ID | 418626791792-gsveb06k19nk52sdt12rabc65k3fo6ro.apps.googleusercontent.com |
| 授权重定向 URI | https://aifanyi.com/api/auth/google/callback（唯一） |
| 状态 | 已启用 |

> ⚠️ 生产 client 禁止加入 localhost / 测试 URI。如需开发环境，另建独立 client。

## 验证 Client 是否注册成功

```bash
# 期望 invalid_grant（client 有效但无 code），而非 invalid_client
curl -s -X POST "https://oauth2.googleapis.com/token"   -d "code=fake" -d "client_id=<CLIENT_ID>" -d "client_secret=<SECRET>"   -d "redirect_uri=https://aifanyi.com/api/auth/google/callback" -d "grant_type=authorization_code" | grep error
```

## 常见错误对照

| 现象 | 原因 |
|------|------|
| invalid_client | client_id 抄录错误 / client 未传播（等 5-30 分钟）/ 未启用 |
| redirect_uri_mismatch | 回调地址与配置不一致（含尾斜杠/大小写） |
| 100 用户上限报错 | 仍是 Testing 模式，需发布 In production |
| 未验证应用警告页 | 敏感 scope 或未完成品牌信息；本应用最小 scope + 完整品牌，已无警告 |
