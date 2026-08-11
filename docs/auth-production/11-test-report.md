# 11 · 测试报告（Phase 6 验收）

> 执行：2026-08-12，服务器 /opt/aifanyi 内网 127.0.0.1:3000 直测（绕过公网/CDN）
> 脚本：scripts/phase6-acceptance-test-v2.mjs（DB 直造用户+Session，绕开 SMTP 依赖）
> 结果：**26 通过 / 0 失败**

## A. 认证基础（6）

| # | 用例 | 结果 |
|---|------|------|
| A1 | 首页 200 | ✅ |
| A2 | /account 未登录 307 重定向登录 | ✅ |
| A3 | /api/auth/me 未登录返回 {user:null} | ✅ |
| A4 | /api/auth/logout 未登录幂等 200 | ✅ |
| A5 | Google OAuth 发起 307 + state + client_id | ✅ |
| A6 | callback 无 state cookie 被拒绝 | ✅ |

## B. Email OTP（3）

| # | 用例 | 结果 |
|---|------|------|
| B1 | 非法邮箱 400 | ✅ |
| B2 | 合法邮箱请求被受理 | ✅ |
| B3 | 60s 内重复发送 429 冷却 | ✅ |

## C. 设备管理（8）

| # | 用例 | 结果 |
|---|------|------|
| C1 | devices 列表=2 | ✅ |
| C2 | logout-all exceptCurrent 200 | ✅ |
| C3 | 被退出设备 /me 返回 user:null | ✅ |
| C4 | 撤销后设备数=1 | ✅ |
| C5 | 能看到对方设备 | ✅ |
| C6 | 单设备退出 200 | ✅ |
| C7 | 被退出设备 /me 返回 user:null | ✅ |
| C8 | 不能退出当前设备 400 | ✅ |

## D. Ownership（3）

| # | 用例 | 结果 |
|---|------|------|
| D1 | 未登录+不存在任务 404 | ✅ |
| D2 | 用户A访问用户B任务 404 | ✅ |
| D3 | 用户B访问自己任务 200 | ✅ |

## E. 账户（5）

| # | 用例 | 结果 |
|---|------|------|
| E1 | PATCH 昵称 200 | ✅ |
| E2 | DELETE 账户 200 + cookie 清除 | ✅ |
| E3 | 删除后旧 session 返回 user:null | ✅ |
| E4 | 级联：session 清零 | ✅ |
| E5 | 级联：PdfJob 清零 | ✅ |

## F. 限流（1）

| # | 用例 | 结果 |
|---|------|------|
| F1 | OTP send IP 第 5 次后 429 | ✅ |

## 测试中发现并修复的真 Bug

| Bug | 发现 | 修复 |
|-----|------|------|
| SESSION_SECRET 变量名拼写（SESSION_CRET）→ 运行时密钥缺失，Google 登录必失败 | 登录 E2E 失败 + 日志 | f75c8b0 修正变量名 |
| validateSession 未校验 revokedAt → 退出设备后会话仍有效 | 验收 C3/C7 失败 | 8229b02 增加 revokedAt 检查 |
| devices 路由被 DELETE 版覆盖（GET 丢失 405） | 部署冒烟 405 | f94b900 合并 GET+DELETE |
| /api/account/delete 与 DELETE /api/account 重复 | 代码审查 | 删除旧路由，统一 DELETE /api/account |

## 浏览器 E2E（Phase 2 已测）

- Google 登录闭环：选择账号 → 自动授权（无未验证警告）→ /account?login=success → 显示 Wang Lie/domaincool@gmail.com ✅
- DB 验证：AuthIdentity 新增 google 记录（sub=115919026542274774037）✅
