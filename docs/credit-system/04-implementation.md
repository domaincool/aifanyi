# Credit & Usage System — 实施交付文档（04-implementation.md）

> 版本：2026-08-12 · 状态：已上线（阶段 1-9 全部完成）· 关联：01-audit / 02-architecture / 03-migration-plan

## 1. 概述

爱翻译（aifanyi.com）统一额度系统（Credit System）已按「Audit → Architecture → Migration → Implementation」流程全量上线。所有 AI 功能共用一套额度引擎：**只有翻译成功才扣费、提交前拦截不足、按实际用量结算、失败自动退回、用量透明可查**。产品哲学：让用户放心使用 AI，不教用户理解积分规则（用户侧文案统一为「使用额度」，不出现钱包/账本/积分术语）。

## 2. API 清单

### 2.1 用户侧
| API | 方法 | 说明 |
|---|---|---|
| `/api/translate` | POST | 文本翻译/润色；游客降级（不结算）；登录用户 reserve→按实际 consume；缓存命中免扣 |
| `/api/pdf/translate` | POST | PDF 翻译；登录必填（401 引导）；2/页封顶 200；成功按翻译块比例结算 |
| `/api/subtitle/translate` | POST | 字幕翻译；登录必填；1/分钟；按成功 cue 比例结算 |
| `/api/image/translate` | POST | 图片翻译；登录必填；固定 3/张 |
| `/api/web/translate` | POST | 网页翻译；登录必填；2/千字（按成功段落） |
| `/api/doc/translate` | POST | Word/PPT 翻译；登录必填；2/千字（按成功段落） |
| `/api/blindtest` | POST | 盲测擂台；0 额度（获客），写 UsageRecord 统计 |
| `GET /api/credit/balance` | GET | 额度数据（可用/预留/本月已用/来源/到期日）+ 注册赠送 300 懒触发 |
| `GET /api/credit/history` | GET | 最近 30 条用户友好明细（服务端翻译 Ledger） |
| `GET /api/credit/estimate` | GET | 预计消耗（服务端算价：?feature=&pages=&chars=&minutes=） |
| `GET /api/pdf/tasks/:id` `PATCH` | GET/PATCH | 任务进度轮询 / 取消（未完成全退） |
| `GET /api/subtitle/tasks/:id` `PATCH` | GET/PATCH | 同上 |

### 2.2 管理侧（ADMIN_EMAILS 鉴权）
| API | 方法 | 说明 |
|---|---|---|
| `GET /api/admin/credits/users` | GET | 用户额度列表（可用/预留/注册时间） |
| `GET /api/admin/credits/users/:id` | GET | 单用户 Ledger/Usage/Grant/PDF Job 全貌 |
| `POST /api/admin/credits/adjust` | POST | 调整额度（±，必填 reason≥2 字，adminId 落库，超扣拒绝） |
| `GET /api/admin/credits/reconcile` | GET | 实时对账（mismatch 列表 + ReconciliationRecord 历史） |

### 2.3 内部（不对外的引擎 API）
`src/lib/credit/engine.ts`：reserve / consume / release / refund / grantCredits / expireCredits / adminAdjustment / getBalance / ensureCreditAccount

## 3. 数据表结构（新增/改造）

| 表 | 用途 | 关键字段 |
|---|---|---|
| `CreditAccount` | 用户额度账户 | balance（可用）/ reservedBalance（预留）/ version（乐观锁，行锁兜底） |
| `CreditLedger` | 追加式审计流水 | type（reserve/consume/release/refund/grant/expire/admin_adjust）/ amount / idempotencyKey（唯一，幂等）/ metadata |
| `CreditGrant` | 额度批次 | type（BONUS/ADMIN_ADJUSTMENT…）/ totalAmount / remainingAmount / reservedAmount / expiresAt |
| `UsageRecord` | 用量明细 | feature / estimatedCredits / reservedCredits / consumedCredits / status / completedAt |
| `PricingRule` | 版本化定价 | feature + version 唯一；seed 7 条（text/doc/web/polish 2/千字、pdf 2/页封顶 200、image 3/张、subtitle 1/分钟、盲测 0） |
| `ReconciliationRecord` | 对账异常 | checkType / expected / actual / diff / status（open） |
| PdfJob/SubtitleJob/TranslationJob | 任务 | +creditState / reservedCredits / consumedCredits / pricingRuleVersion |

**对账不变量**：`CreditAccount.available + reserved == Σ CreditLedger.amount`（reserve/release 为形态变化记 0 金额；grant/consume/refund/admin/expire 记 ±值）

## 4. 并发与一致性

- **行锁**：所有余额操作在事务内 `SELECT ... FOR UPDATE` 锁账户行 + 应用层检查（修复了 `UPDATE...WHERE balance>=x` 相对减并发穿透）
- **幂等**：`idempotencyKey` 唯一约束（P2002 捕获）；同一 jobId 的 reserve/consume/release 重复调用安全
- **并发实测**：余额 90、10 并发×30 → 恰 3 成功、余额永不为负（34/34 单测全绿）

## 5. 运维手册

### 5.1 部署
```bash
# 本地
git push origin main
# 服务器（root@47.74.23.240:/opt/aifanyi）
bash -c 'git checkout -- package.json package-lock.json && git pull origin main && rm -rf .next && npm run build && pm2 delete aifanyi; fuser -k 3000/tcp; pm2 start npm --name aifanyi -- start'
```

### 5.2 Schema 变更
```bash
npx prisma db push --accept-data-loss --skip-generate  # 仅新增字段时；先确认空表
npx prisma generate
npx tsx prisma/seed-pricing.ts                         # 定价规则（幂等 upsert）
```

### 5.3 扫描器 / 对账
- crontab（root）：`*/30 * * * * cd /opt/aifanyi && /usr/local/bin/node /opt/aifanyi/node_modules/.bin/tsx scripts/credit-reconciler.ts >> /var/log/credit-reconciler.log 2>&1`
- 职责：超时(1h)未结算任务强制结算（completed 按比例 consume / failed·cancelled 全退 / 卡死标 failed 全退）+ 过期 Grant 到期 + 全量对账（mismatch 写 ReconciliationRecord，不静默修复）
- 查看：`/admin/credits`（对账报告）或 `GET /api/admin/credits/reconcile`

### 5.4 Admin 配置
- `.env`：`ADMIN_EMAILS=domaincool@gmail.com`（逗号分隔；不入 git）

### 5.5 回滚
- 阶段 1-2 纯新增可随时停；阶段 3-8 已接线，如需回退旧逻辑：`CREDIT_ENGINE_ENABLED=false` 开关（功能级，余额数据保留）；页面级可独立回滚

## 6. 已知限制 / 待办

1. **上传前「预计约 X 额度」提示**（工具页/首页）未做——前端已可通过 `/api/credit/estimate` 获取，UI 待补（6b）
2. **低余额全局轻提示**：目前仅 /credit 页显示（<60 阈值），未做全局 toast
3. **对账 7 天观察**：上线至今 mismatch 0；建议连续观察 7 天
4. **定价规则版本化**：PricingRule 支持多版本，但当前代码固定 version=1 结算（`pricingRuleVersion: 1` 写死），未来调价需同步改结算引用
5. **PDF/字幕 30 分钟扫描器间隔**：卡死任务最长 1h+30min 才被回收（可接受；额度只在成功时扣，超时全退）
6. **删除账户会话失效补测**：功能已上线（validateSession 检查 status），浏览器端补测待执行
7. **游客文本翻译免费**：设计如此（获客 + 低成本），如未来滥用可加游客限流

## 7. 测试摘要

| 项 | 结果 |
|---|---|
| Engine 单测（并发/幂等/退款/过期/对账） | 34/34 ✅ |
| 同步 API E2E（image/web/doc 401/402/结算） | 全绿 ✅ |
| 异步 API E2E（PDF/字幕成功/取消/失败） | 全绿 ✅ |
| 文本/润色/盲测 E2E | 全绿 ✅ |
| /credit 注册赠送懒触发 + 幂等 | 全绿 ✅ |
| Admin adjust / 超扣拒绝 / 403 | 全绿 ✅ |
| 删户软删 + Ledger 保留 + 对账 | 全绿 ✅ |
| 生产对账 | 0 mismatch ✅ |
| 关键页面 10 个 | 200 ✅ |
