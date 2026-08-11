# aifanyi.com 生产级认证系统：审计报告 + 目标架构 + 迁移计划

> 状态：**AUDIT COMPLETE（审计完成）** | 日期：2026-08-11 | 作者：工程师 agent
> 范围：Production Authentication Architecture Redesign（不破坏 PDF Translator 业务）

---

## 一、CURRENT AUTH ARCHITECTURE（当前认证架构审计）

### 1.1 认证相关文件清单

| 文件 | 职责 | 现状 |
|---|---|---|
| `src/lib/auth/google.ts` | Google OAuth 授权 URL + code 交换 | scope=openid email profile；access_type=online（不申请 refresh token ✅） |
| `src/app/api/auth/google/route.ts` | 发起 Google 登录 | 重定向到 Google 授权页 |
| `src/app/api/auth/google/callback/route.ts` | OAuth 回调 | 收 code → 换 token → 找/建 User → 建 Session → 设 Cookie |
| `src/lib/auth/session.ts` | Session 管理 | **JWT(HS256) + DB 双写**，30 天 |
| `src/lib/auth/cookie.ts` | Cookie 工具 | aifanyi_session（登录）+ aifanyi_guest（游客 24h） |
| `src/lib/auth/email-otp.ts` | Email OTP | 6 位数字 / SHA-256 哈希 / 5 分钟 / 一次性 / 60s 发送间隔 |
| `src/lib/auth/migrate.ts` | 游客→用户迁移 | guestSessionId → userId（PdfJob updateMany） |
| `src/lib/auth/require-auth.ts` | API 鉴权 | 401 检查 |
| `src/app/api/auth/email/send|verify/route.ts` | OTP 发送/验证 | 有基础校验 |
| `src/app/api/auth/logout|me/route.ts` | 登出/当前用户 | 基础实现 |
| `prisma/schema.prisma` | 数据模型 | User / Session / VerificationToken / PdfJob 等 |

### 1.2 当前数据模型

- **User**：id, email(unique), emailVerified, nickname, avatar, **authProvider**(单值 'google'|'email'), status, lastLoginAt
- **Session**：id, sessionToken(unique), userId, expiresAt, createdAt（**缺 lastUsedAt/ipHash/userAgentHash/revokedAt**）
- **VerificationToken**：identifier, tokenHash, expiresAt, used（**缺尝试次数**）
- **PdfJob**：userId? + guestSessionId?（已支持游客/用户双轨 ✅）

### 1.3 当前 Google OAuth 流程

```
前端点「使用 Google 登录」
  → GET /api/auth/google（无 state 参数 ⚠️）
  → 302 accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=.../api/auth/google/callback&response_type=code&scope=openid+email+profile&access_type=online&prompt=select_account
  → 用户授权 → 302 回 callback?code=xxx
  → server 端 POST oauth2.googleapis.com/token 换 token（client_secret 仅存服务端 ✅）
  → base64 解码 id_token（**未验证签名/iss/aud ⚠️**）
  → prisma.user.findUnique({email}) → 无则创建 / 有则更新
  → createSession(userId) → JWT(HS256) + DB 落库
  → setCookie(aifanyi_session, HttpOnly/Secure/SameSite=Lax, 30d)
  → 302 /account?login=success
```

### 1.4 当前 Session 机制

- JWT payload：{ sub: userId, jti: sessionId, iat, exp }，HS256 签名
- **`SECRET_KEY = process.env.SESSION_SECRET || ''`** —— **.env 中无 SESSION_SECRET，实际用空字符串签名 ⚠️🚨**
- DB 同步存 session 记录（可撤销）
- validateSession：验签 + DB 存在 + 未过期 + user active
- 支持 revokeSession / revokeAllUserSessions

### 1.5 当前 OTP 机制

- 6 位数字，SHA-256 哈希存储，5 分钟有效，一次性使用
- 发送频率：同一邮箱 60 秒冷却
- **无验证尝试次数上限 ⚠️**（可无限暴力试 6 位码）
- **无 IP 维度限流 ⚠️**
- **SMTP 未配置时 console.warn 打印验证码 ⚠️**（生产泄露风险）

### 1.6 游客与 PDF 业务

- 游客：aifanyi_guest cookie（maxAge 86400 = 24h，注释称"浏览器会话级"但实现是 24h ⚠️）
- 迁移：登录后 migrateGuestTasks 把 guestSessionId 下的 PdfJob 转给 userId ✅
- **GET /api/pdf/tasks/:taskId 无 ownership 检查 ⚠️🚨**（知道 taskId 即可读任意用户 PDF 内容）
- 额度：clientKey(IP+UA hash) 防滥用 + userId/guestSessionId 维度

---

## 二、PROBLEMS（发现的问题清单）

### P0（必须立即修复 — 安全漏洞）

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| P0-1 | **SESSION_SECRET 为空字符串**，JWT 用空密钥 HS256 签名 | session.ts | 攻击者可伪造任意 session token → **账户接管** |
| P0-2 | **GET /api/pdf/tasks/:taskId 无 ownership 检查** | tasks/[taskId]/route.ts | 任意用户可读取他人 PDF 译文/原文 |
| P0-3 | **OAuth 无 state 参数** | google.ts / callback | OAuth Login CSRF / Authorization Code Injection |
| P0-4 | **id_token 未验证签名与 iss/aud** | google.ts | 理论上可伪造身份声明（需配合 code 交换，风险中高） |

### P1（生产就绪必须修复）

| # | 问题 | 说明 |
|---|---|---|
| P1-1 | Google OAuth **Testing 模式** | 100 用户限制 / 测试白名单 / 未生产发布 |
| P1-2 | **OAuth client 当前报 invalid_client** | client 创建成功但 Google 后端未注册（待传播/重新处理） |
| P1-3 | **无环境隔离** | 单 .env，无 dev/staging/prod 独立 OAuth client |
| P1-4 | OTP 无验证次数限制 | 6 位码可无限尝试（需 5 次上限 + IP 限流） |
| P1-5 | SMTP 未配置时打印验证码到日志 | 生产泄露 |
| P1-6 | Session 表缺安全字段 | 无 lastUsedAt/ipHash/userAgentHash/revokedAt → 无法设备管理 |
| P1-7 | 无 Rate Limit 框架 | 登录/OTP/callback 端点无多维限流 |
| P1-8 | 错误处理泄露内部信息 | callback catch 把 e.message 拼进 URL 重定向 |
| P1-9 | **无删除账户功能** | /account 有设置 tab 但无 DELETE ACCOUNT |
| P1-10 | 无「退出所有设备/单设备」UI | revokeAllUserSessions 函数存在但无入口 |
| P1-11 | 游客 cookie 24h 与"会话级"注释不符 | 需按策略明确 |

### P2（架构改进）

| # | 问题 | 说明 |
|---|---|---|
| P2-1 | User.authProvider 单值字段 | 无法表达"同一邮箱 Google+Email 双身份"；未来 Apple/微信需重构 → 应建 AuthIdentity |
| P2-2 | 登录/注册 UI 分开 | 应统一「登录/注册」 |
| P2-3 | Session 30 天固定无滑动刷新 | 需支持刷新策略 |
| P2-4 | 首页/account 无 TOS/隐私页 | Google 生产发布要求真实 URL |
| P2-5 | VerificationToken 无尝试计数字段 | 无法实现"最多验证 5 次" |

---

## 三、TARGET PRODUCTION ARCHITECTURE（目标生产架构）

### 3.1 架构总览

```
┌────────────────────────────────────────────────────────┐
│ 前端 UI（登录/注册统一弹窗）                              │
│  [ G 使用 Google 登录 ]   [ 邮箱 OTP ]                   │
└───────────────┬────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────┐
│ API 层（Next.js Route Handlers）                        │
│  POST /api/auth/google/init   → 生成 state + 302 Google │
│  GET  /api/auth/google/callback → 验 state + code 交换  │
│  POST /api/auth/email/send    → OTP 发送（限流）        │
│  POST /api/auth/email/verify  → OTP 验证 + 登录         │
│  POST /api/auth/logout        → 撤销当前 session        │
│  POST /api/auth/logout-all    → 撤销全部 session        │
│  DELETE /api/account          → 删除账户                │
└───────────────┬────────────────────────────────────────┘
                │ 验证身份
┌───────────────▼────────────────────────────────────────┐
│ Auth Core（服务端，不暴露给浏览器）                      │
│  Google: 验 state → code exchange → 验 id_token 签名/aud│
│  OTP:    哈希比对 → 5 次上限 → 10 分钟有效               │
│  Identity: AuthIdentity(provider, providerAccountId)    │
│            → find/create User（verified email 合并）    │
│  Session: 随机 token(256bit) 或 JWT(强密钥) + DB         │
│           支持 创建/刷新/过期/注销/全部注销/撤销         │
└───────────────┬────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────┐
│ 数据库（PostgreSQL / Prisma）                           │
│  User / AuthIdentity / Session / VerificationToken     │
│  PdfJob(userId? guestSessionId?) → 全部 API 做 Ownership│
│  UsageLedger / CreditAccount / CreditLedger            │
└────────────────────────────────────────────────────────┘
```

### 3.2 目标数据模型

```prisma
// User = 统一账户（未来 Subscription/Credit 的 owner）
model User {
  id            String    @id @default(cuid())
  email         String?   @unique   // 主邮箱（verified 后使用）
  emailVerified DateTime?
  nickname      String?
  avatar        String?
  status        String    @default("active")  // active|disabled|deleted
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  identities   AuthIdentity[]
  sessions     Session[]
  pdfJobs      PdfJob[]      @relation("UserPdfJobs")
  usageLedgers UsageLedger[]
  creditAccount CreditAccount?
  creditLedgers CreditLedger[]
  // ... 业务关联保持
}

// AuthIdentity = 多 Provider 身份（Google/Email/Apple/微信 未来）
model AuthIdentity {
  id                String   @id @default(cuid())
  userId            String
  provider          String   // 'google' | 'email' | 'apple' | 'wechat' | ...
  providerAccountId String   // Google sub / 邮箱 / Apple sub
  providerEmail     String?  // 该 provider 的邮箱快照
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

// Session = 服务端会话（支持设备管理）
model Session {
  id            String    @id @default(cuid())
  sessionToken  String    @unique   // 随机 256bit 或强密钥 JWT
  userId        String
  createdAt     DateTime  @default(now())
  lastUsedAt    DateTime  @default(now())
  expiresAt     DateTime
  revokedAt     DateTime?
  ipHash        String?
  userAgentHash String?
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([sessionToken])
}

// VerificationToken = OTP（强化）
model VerificationToken {
  id         String    @id @default(cuid())
  identifier String    // email
  tokenHash  String
  expiresAt  DateTime
  used       Boolean   @default(false)
  attempts   Int       @default(0)   // 验证尝试次数（≤5）
  createdAt  DateTime  @default(now())
  @@index([identifier])
}
```

### 3.3 Google OAuth 生产配置目标

| 项 | 目标值 |
|---|---|
| User Type | **External（外部）** |
| Publishing status | **In production（已发布）** |
| OAuth Client（生产） | 独立 Web client，**仅含** `https://aifanyi.com` |
| Authorized redirect URI | `https://aifanyi.com/api/auth/google/callback`（仅此一个） |
| Authorized JS origins | `https://aifanyi.com`（仅此一个） |
| Authorized domains | `aifanyi.com` |
| Scopes | **仅 openid email profile**（无任何敏感 scope，无需完整 verification；需提供隐私政策 URL） |
| Privacy Policy | `https://aifanyi.com/privacy`（需真实页面） |
| Terms of Service | `https://aifanyi.com/terms`（需真实页面） |
| Support email | domaincool@gmail.com |
| Developer contact | domaincool@gmail.com |
| App name / Logo | 爱翻译 aifanyi.com / 品牌 logo |
| Staging client | 独立 client，仅含 `https://staging.aifanyi.com`（如建 staging） |

### 3.4 OAuth 安全目标

- ✅ **state 参数**：发起时生成随机 state（存 cookie/httpOnly），callback 校验（防 CSRF/Login CSRF/Code Injection）
- ✅ **id_token 签名验证**：用 `jose` 或 google-auth-library 验证 iss/aud/exp/签名
- ✅ code 仅服务端交换，client_secret 永不进浏览器
- ✅ access_type=online（业务只需身份，不存 refresh token；Google 数据访问非业务需求）
- ✅ 错误处理：用户见「登录失败，请重试」，详细错误记服务端日志
- ✅ 取消测试白名单依赖

### 3.5 Session 目标

- 随机 256-bit token（或强密钥 HS256 JWT + DB 双写，**必须独立 SESSION_SECRET ≥32 字节**）
- Cookie：HttpOnly + Secure + SameSite=Lax + Path=/（**不显式设 Domain**，保持 host-only）
- 30 天有效期 + 滑动刷新（lastUsedAt 更新）
- 支持：创建 / 刷新 / 过期 / 注销（当前设备）/ 全部注销 / 单设备注销 / 撤销
- 登录后**不用 Google token 维持会话**——只有 aifanyi_session cookie

### 3.6 账户合并规则

- 同一 **verified email** 的 Google 与 Email OTP 身份 → 关联到**同一 User**
- AuthIdentity 唯一索引 (provider, providerAccountId)
- 合并前提：**verified identity**（Google email_verified=true / OTP 验证成功），绝不因未验证 email 字符串自动合并
- 冲突策略：登录时若 AuthIdentity 不存在但 email 匹配已有 User → 创建 AuthIdentity 绑定到该 User（安全合并）

### 3.7 游客迁移目标

- 游客：guestSessionId（cookie）
- 登录成功 → 自动 claim：PdfJob / DocumentProgress / UsageLedger（guestSessionId → userId）
- 用户无需重新上传 PDF

### 3.8 Authorization（Ownership Check）

所有资源 API 强制校验：
```
GET/POST /api/pdf/...        → job.userId === currentUser.id 或 job.guestSessionId === currentGuest.id，否则 404/403
GET/DELETE /api/account/...  → 仅本人
```
不依赖前端隐藏按钮。

---

## 四、MIGRATION PLAN（迁移计划）

### Phase 0 — P0 安全热修复（上线后立即做，不改 schema）
1. ✅ 补 SESSION_SECRET（≥32 字节随机）到 .env + 服务器 .env
2. 修复 GET /api/pdf/tasks/:taskId ownership 检查
3. Google OAuth 加 state（init 存 cookie + callback 校验）
4. id_token 验证（jose verifyJwt 验 iss/aud/exp）

### Phase 1 — Schema 迁移
1. 新建 AuthIdentity 表 + Session 扩展字段（lastUsedAt/ipHash/userAgentHash/revokedAt）+ VerificationToken.attempts
2. prisma migrate / db push（**先备份 DB**）
3. 数据回填：现有 User.authProvider → AuthIdentity（google/email）
4. 双写过渡 → 切新逻辑

### Phase 2 — Google OAuth Production 化（需开发者 Console 操作）
1. 等 OAuth client 注册生效（当前 invalid_client 问题解决）或重建 client
2. 补全 Branding：Logo、首页、隐私政策、服务条款 URL
3. **发布应用**（External → In production）
4. 建独立 Production client（仅 aifanyi.com）
5. 代码切到 SESSION_SECRET / 新 state 流程

### Phase 3 — Email OTP 加固
1. attempts ≤5 / 10 分钟有效 / 发送限流（email + IP 双维度）
2. SMTP 配置检查（不打印验证码；生产必须配 SMTP）

### Phase 4 — 账户中心 + 设备管理
1. /account 显示头像/昵称/邮箱 + 我的翻译 + 额度 + 设置 + 安全 + 退出
2. 设备列表（Session 记录）+ 退出当前/全部设备
3. DELETE ACCOUNT（级联删除 User/AuthIdentity/Session/PdfJob/UsageLedger，文件立即失效）

### Phase 5 — Rate Limit + 审计日志
1. 登录/OTP send/OTP verify/OAuth callback 多维限流（IP + email + session）
2. 事件审计（auth 事件表或日志）

### Phase 6 — 验收 + 发布
1. 按「三十、最终验收」25 项测试全跑
2. 交付文档全套
3. Production Launch Checklist

---

## 五、需要开发者在 Google Cloud Console 手动完成的清单

1. ☐ 确认/修复 OAuth client（当前 invalid_client，需等传播或重建）
2. ☐ 补全 Branding：应用 Logo 图片
3. ☐ 提供 Privacy Policy 页面 URL（`https://aifanyi.com/privacy`，需网站有真实页面）
4. ☐ 提供 Terms of Service 页面 URL（`https://aifanyi.com/terms`）
5. ☐ **点击「发布应用」（Publish App）→ External → In production**（这是 Google 端唯一能解除 100 用户/测试限制的动作）
6. ☐ 确认 OAuth client 仅含生产 redirect URI（`https://aifanyi.com/api/auth/google/callback`），无 localhost/测试 URI
7. ☐ 确认 scopes 仅 openid email profile（无需敏感 scope）
8. ☐ 如未来申请敏感 scope → 需提交 Google OAuth verification（本方案不需要）

**说明**：scope 仅为 openid/email/profile 且非敏感时，**通常无需完整 Google 验证**，但 Google 要求公开的隐私政策 URL。若产品需 Gmail/Drive 等敏感 scope 才需要完整验证流程（本方案明确不使用）。

---

## 六、Environment Variables（目标配置）

```env
# 生产 .env.production（全部仅存服务端，不入 git）
DATABASE_URL=...
GOOGLE_CLIENT_ID=...        # 生产 client
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://aifanyi.com/api/auth/google/callback
APP_URL=https://aifanyi.com
SESSION_SECRET=<32+ 字节随机串>   # P0 必须
COOKIE_DOMAIN=              # 留空 = host-only（推荐）
EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@aifanyi.com

# 业务配置（现有保留）
NEXT_PUBLIC_SITE_URL=https://aifanyi.com
DEEPSEEK_API_KEY=...
GLM_API_KEY=...
GOOGLE_TRANSLATE_API_KEY=...
MODEL_BUDGET_MONTHLY_CNY=...
PDF_GLOBAL_DAILY_CAP=...
```

禁止：SESSION_SECRET/GOOGLE_CLIENT_SECRET 进 git / NEXT_PUBLIC_* / 前端 bundle / DB 明文。

---

## 七、Security Checklist（安全清单）

- [ ] SESSION_SECRET 强密钥（≥32 字节，未入 git）
- [ ] OAuth state 生成 + 校验（CSRF/Login CSRF/Code Injection）
- [ ] id_token 签名/iss/aud/exp 验证
- [ ] code 仅服务端交换，client_secret 不进浏览器
- [ ] Cookie HttpOnly + Secure + SameSite=Lax
- [ ] Session 支持创建/刷新/过期/注销/全部注销/撤销
- [ ] OTP 哈希存储 + 10 分钟 + 5 次上限 + 单次使用
- [ ] OTP 发送限流（email + IP）
- [ ] 账户合并基于 verified email
- [ ] 所有资源 Ownership Check（403/404）
- [ ] Rate Limit（登录/OTP/callback）
- [ ] 错误信息不泄露内部细节
- [ ] 删除账户级联清理 + 文件失效
- [ ] 无测试模式依赖（Test Users / 100 限制 / 7 天 refresh）
- [ ] Secret 不进入 git / 前端 / NEXT_PUBLIC_*

---

## 八、交付物清单（完成后）

1. ✅ 本审计报告（当前架构 + 问题 + 目标架构 + 迁移计划）
2. 数据库 Schema（AuthIdentity + Session 扩展）
3. API 清单
4. Google Cloud 配置清单
5. OAuth scopes 清单（openid email profile）
6. Google Verification 判断（无需完整验证，需隐私政策 URL）
7. Environment Variables
8. Migration Plan（Phase 0-6）
9. Security Checklist
10. Test Report（25 项验收）
11. Production Launch Checklist
