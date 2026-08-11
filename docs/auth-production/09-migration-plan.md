# 09 · 迁移计划（已执行记录）

## Phase 0 — P0 热修复（不改 Schema）✅

1. session.ts：SESSION_SECRET fail-fast（惰性校验避免 build 失败）
2. tasks/[taskId]：ownership 检查（404）
3. google.ts：state 参数 + tokeninfo 验签
4. google/route.ts + callback：state cookie 生成/校验
5. 部署验证：home 200 + OAuth 重定向带 state

## Phase 1 — Schema 迁移 ✅

1. 备份 DB：pg_dump 全量
2. Schema：AuthIdentity / Session 扩展 / VerificationToken.attempts
3. prisma db push（生产）
4. 回填：10 个存量 User 按 authProvider 建 email AuthIdentity
5. google.ts 重写为 AuthIdentity 驱动（sub 查找 → verified email 合并）
6. email-otp：attempts 上限 + 60s 冷却 + 不打印验证码
7. 部署验证：home/pdf/meme 200 + google-login 307

## Phase 2 — Google 生产化 ✅

1. 修正 Client ID（OCR 抄录错误 → 控制台精确复制）
2. 浏览器代理发布应用 In production
3. /privacy /terms 页面上线
4. E2E 登录闭环实测通过（domaincool@gmail.com → /account?login=success）

## Phase 3 — OTP 加固 ✅

1. rate-limit.ts 通用滑动窗口
2. send：IP 5次/h + email 3次/h
3. verify：IP 20次/h

## Phase 4 — 账户中心 ✅

1. GET/DELETE /api/auth/devices、POST /api/auth/logout-all
2. PATCH/DELETE /api/account
3. AccountClient「安全」tab（设备列表/退出/注销）
4. **Phase 6 修复：validateSession 增加 revokedAt 校验**

## Phase 5 — Rate Limit ✅（随 Phase 3）

## Phase 6 — 验收 ✅

26 项全链路测试全绿（见 11 文档）

## 回滚预案

- 代码：git revert 对应 commit 后走标准部署
- Schema：pg_dump 备份可恢复；AuthIdentity 表独立，不影响旧逻辑
