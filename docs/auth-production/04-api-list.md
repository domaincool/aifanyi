# 04 · 认证相关 API 清单

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/auth/google | - | 发起 OAuth（生成 state cookie → 302 Google） |
| GET | /api/auth/google/callback | state cookie | 回调：验 state→验 id_token→建身份→建 session |
| POST | /api/auth/email/send | IP+email 限流 | 发送 OTP（5次/h/IP + 3次/h/邮箱 + 60s 冷却） |
| POST | /api/auth/email/verify | IP 限流 | 校验 OTP（attempts≤5，10min 过期）→ 登录 |
| POST | /api/auth/logout | - | 退出（幂等 200） |
| GET | /api/auth/me | - | 当前用户（未登录返回 {user:null} 200） |
| GET | /api/auth/devices | ✅ 登录 | 设备列表（含 current 标记） |
| DELETE | /api/auth/devices | ✅ 登录 | 单设备退出（不能退当前，404 他人设备） |
| POST | /api/auth/logout-all | ✅ 登录 | 退出全部或 exceptCurrent |
| PATCH | /api/account | ✅ 登录 | 更新昵称 |
| DELETE | /api/account | ✅ 登录 | 删除账户（级联清理） |
| GET | /api/account/history | ✅ 登录 | 翻译历史 |
| GET | /api/account/usage | ✅ 登录 | 使用额度 |
| POST | /api/account/migrate | ✅ 登录 | 游客数据迁移 |
| GET | /api/pdf/tasks/:taskId | ownership | **userId/guestSessionId 不匹配返 404** |

## 未登录访问安全语义

| 端点 | 未登录 | 无效 session | 他人资源 |
|------|--------|--------------|----------|
| /api/auth/me | 200 {user:null} | 200 {user:null} | - |
| /api/auth/devices GET | 401 | 401 | - |
| /api/account DELETE | 401 | 401 | - |
| /api/pdf/tasks/:id | 404 | 404 | 404（不泄露存在性） |

## Cookie 规格

| Cookie | HttpOnly | Secure | SameSite | 有效期 |
|--------|----------|--------|----------|--------|
| aifanyi_session | ✅ | ✅ | Lax | 30 天 |
| aifanyi_guest | ✅ | ✅ | Lax | 24h |
| aifanyi_oauth_state | ✅ | ✅ | Lax | 30 分钟（一次性） |

> 无 localStorage 长期 token；无 refresh token 依赖（access_type=online，仅身份）。
