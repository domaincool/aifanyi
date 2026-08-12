# aifanyi.com · Credit & Usage System — 02 Target Architecture

> 目标：「后台严格可审计，前台极简可理解」。用户只看到「额度」，永远看不到 Ledger/Reserve/Grant。
> 原则：统一 Credit Engine 服务所有 AI 功能；不建多余额体系；余额永不为负；一切可追溯；幂等 + 并发安全。
> 最高产品原则：**让用户「放心使用 AI」，而不是「理解积分规则」**——后台再复杂，前台只传递「安心」：不会乱扣、不会半路卡住、失败自动退、用量透明、绝不打扰。

---

## 1. Architecture Diagram

```
                     ┌────────────────────────────────────────────────────┐
                     │                    FRONTEND (简单)                  │
                     │  额度页 / 预计消耗提示 / 不足&低余额提示 / 历史明细   │
                     └──────────────┬─────────────────────────────────────┘
                                    │ 用户只提交「我要翻译这个」+ 身份
                                    ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │                      FEATURE API 层（认证必过）                         │
 │  /api/translate · /api/pdf/translate · /api/image/translate            │
 │  /api/subtitle/translate · /api/doc/translate · /api/web/translate     │
 │  /api/polish · /api/blindtest                                          │
 └───────────────┬───────────────────────────────────────────────────────┘
                 │  Estimate(特征量) → Reserve(幂等)
                 ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │                     CREDIT ENGINE（唯一计费入口）                        │
 │  Reserve ──► Consume ──► Release ──► Refund                            │
 │  原子锁：UPDATE CreditAccount SET available=available-Δ WHERE avail≥Δ  │
 │  幂等键：jobId+op（Ledger unique 约束兜底）                             │
 │  PricingRule 查价（版本化）→ 写 CreditLedger(append-only)              │
 └───────┬───────────────────────────────┬───────────────────────────────┘
         │ Reserve 后 Job 进入 worker      │ Consume/Release 由 worker 结算
         ▼                               ▼
 ┌──────────────────────┐      ┌──────────────────────────────────────────┐
 │  Job Worker 层        │      │  数据层（Prisma/PostgreSQL）              │
 │  PDF/字幕/图片/网页/   │      │  CreditAccount(余额缓存,version 乐观锁)    │
 │  Word-PPT 后台翻译     │      │  CreditGrant(来源/剩余/过期)              │
 │  成功→Consume 实际     │      │  CreditLedger(append-only 审计,幂等键)    │
 │  失败→Release 全部     │      │  UsageRecord(特征量/模型/成本/结算)        │
 │  部分成功→按成功结算    │      │  PricingRule(版本化定价)                 │
 │  取消→按已消费结算      │      │  Job表(creditState/pricingRuleVersion)  │
 └──────────────────────┘      └──────────────────────────────────────────┘
                                        ▲
                     ┌──────────────────┴──────────────────┐
                     │  对账/监控（每日 reconciliation job） │
                     │  Admin 调整（Grant+Ledger，禁直改）    │
                     └─────────────────────────────────────┘
```

---

## 2. Database Schema

### 2.1 新建表

```prisma
// 额度批次：每批额度有来源、剩余、过期时间（支持不同额度不同过期）
model CreditGrant {
  id              String    @id @default(cuid())
  userId          String
  type            String    // FREE_MONTHLY | BONUS | SUBSCRIPTION | PURCHASED | ADMIN_ADJUSTMENT | REFUND
  source          String    // 注册赠送 | 免费额度 | Pro月度 | 购买 | 活动 | 客服补偿 | 退款
  totalAmount     Int       // 本批总额
  remainingAmount Int       // 本批剩余（消费时扣减，永不为负）
  reservedAmount  Int       @default(0) // 本批被预留未结算
  expiresAt       DateTime? // null=永久（购买额度）；有值=到期失效
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@index([userId, expiresAt]) // 消费顺序：先过期先消费
}

// 计费流水：append-only，唯一事实来源（幂等键唯一约束兜底重复）
model CreditLedger {
  id             String    @id @default(cuid())
  userId         String
  type           String    // reserve | consume | release | refund | grant | expire | admin_adjust
  amount         Int       // 正=增加可用，负=减少可用
  grantId        String?   // 来源批次（grant/consume 时关联）
  usageId        String?   // 关联 UsageRecord
  jobId          String?   // 关联业务 Job（pdf_xxx / sub_xxx…）
  referenceId    String?   // 外部引用（taskId 等）
  idempotencyKey String    @unique // 幂等：jobId+op（+序号），重复插入直接冲突
  description    String?
  metadata       Json?
  createdAt      DateTime  @default(now())
  @@index([userId, createdAt])
  @@index([jobId])
}

// 使用记录：用户到底用了什么（特征量 + 模型 + 成本 + 结算），保留各业务独特维度
model UsageRecord {
  id                  String    @id @default(cuid())
  userId              String?
  guestSessionId      String?
  feature             String    // text_translation | pdf_translation | image_translation | subtitle_translation | doc_translation | web_translation | polish | blindtest
  jobId               String?
  documentId          String?
  inputCharacters     Int       @default(0)
  inputTokens         Int       @default(0)
  outputTokens        Int       @default(0)
  provider            String?   // deepseek | glm | google
  model               String?
  // 业务特征量（按 feature 填充，不强制统一）
  pageCount           Int?      // pdf
  imageCount          Int?      // image
  durationSeconds     Int?      // subtitle
  segmentCount        Int?      // subtitle
  paragraphCount      Int?      // doc/web
  // 结算
  estimatedCredits    Int       @default(0) // 预估（reserve 时）
  reservedCredits     Int       @default(0)
  consumedCredits     Int       @default(0)
  releasedCredits     Int       @default(0)
  refundedCredits     Int       @default(0)
  status              String    @default("reserved") // reserved|consumed|released|refunded|partial
  costUsd             Float     @default(0)
  pricingRuleVersion  Int       @default(1) // 锁定价版本，历史不随调价变化
  appliedUnitPrice    Int?      // 结算时实际单价（快照）
  createdAt           DateTime  @default(now())
  completedAt         DateTime?
  @@index([userId, createdAt])
  @@index([feature, createdAt])
  @@index([jobId])
}

// 定价规则（可配置 + 版本化）
model PricingRule {
  id          String    @id @default(cuid())
  feature     String    // text_translation | pdf_translation | …
  unit        String    // per_1000_chars | per_page | per_image | per_minute | per_file | per_segment
  creditRate  Int       // 每 unit 多少 credit
  minCharge   Int       @default(1) // 单次最低
  maxCharge   Int?      // 单次封顶（可空）
  version     Int       @default(1)
  active      Boolean   @default(true)
  effectiveAt DateTime  @default(now())
  createdAt   DateTime  @default(now())
  @@unique([feature, version])
}
```

### 2.2 改造现有表（字段新增）
- `PdfJob` / `SubtitleJob` 增加：`creditState String?`（reserved|consumed|released|refunded）、`reservedCredits Int @default(0)`、`consumedCredits Int @default(0)`、`pricingRuleVersion Int @default(1)`
- `TranslationJob`（文本）增加：`creditState/reservedCredits/consumedCredits/pricingRuleVersion`（可选，文本同步请求可直接结算）
- `CreditAccount` 启用：保留 `balance` 字段（= availableBalance），新增 `reservedBalance Int @default(0)`、`version Int @default(0)`（乐观锁）
- `User` 增加：`defaultPricingRuleVersion Int @default(1)`（用户级定价版本覆盖，未来 Pro 折扣用）
- 删除账户策略调整：**不再硬删 CreditLedger**——`creditState='inactive'` 化（或保留匿名化 userId 哈希），由对账/保留策略决定

---

## 3. Credit State Machine

```
                    Reserve（幂等）                Consume（幂等）
  AVAILABLE ──────────────────► RESERVED ──────────────────► CONSUMED
     ▲                             │  │                          │
     │  Refund（幂等，              │  │ Release（幂等，           │
     │  正向入账+新 Ledger）         │  │ 退回未用部分）             │
     │                             │  └──────────► RELEASED      │
     │                             │  Expire（定时任务）          │
     │                             └──────────► EXPIRED          │
     └─────────────────────────────────────────────────────────────┘
  注：Grant 有独立状态（剩余/过期），CreditLedger 记录每次流转。
```

**不变量**（每步由事务保证）：
1. Reserve：`available -= Δ` 且 `available >= Δ`（原子 UPDATE ... WHERE available >= Δ）；`reserved += Δ`；写 Ledger(-Δ, type=reserve) + UsageRecord(status=reserved)
2. Consume：`reserved -= actual`；按实际扣减各 Grant（先过期先消费）；写 Ledger(-actual, consume) + UsageRecord(consumed=actual)
3. Release：`reserved -= Δ_release`；`available += Δ_release`；写 Ledger(+Δ_release, release)（只在 consume<reserve 时发生）
4. Refund：`available += refund`；写 Ledger(+refund, refund)；**永不修改原 -500 记录**
5. 任何流转都写 Ledger；余额 = 期初 + Σ Ledger（对账依据）

---

## 4. Translation Job State Machine（集成 Credit 后）

```
  queued ──Reserve 成功──► processing ──全部成功──► completed ──► Consume(实际) + Release(剩余)
    │                        │                          │
    │ Reserve 失败            │ 部分成功                  │
    ▼                        ▼                          ▼
  credit_insufficient     partial_completed         completed(refunded)*
  （不建 Job，前端提示）    Consume(成功部分)            （若结算后发现系统错误）
    │                        + Release(失败部分)        └─► Refund
    ▼                        │
  cancelled ◄──用户取消───────┤
    │                        │
    ├─ 未开始：Release 全部   │
    └─ 进行中：Consume(已用) + Release(剩余)
                               │
                               ▼
                          failed ──► Release(全部) 或 Refund(已 Consume 后失败)
                               │
                               └─► credit_settled（终态：creditState ∈ {consumed, released, refunded}）
```

- Job 终态必须到达 `credit_settled`；worker 崩溃/超时由**扫描器**兜底（见 §9）
- `creditState` 记录在 Job 表，供对账核对

---

## 5. API Design

### 5.1 用户侧（全部 requireAuth 或游客降级策略）
| API | 方法 | 用途 | 说明 |
|---|---|---|---|
| `GET /api/credit/balance` | GET | 额度页数据 | `{ available, reserved, grants:[{source,remaining,expiresAt}], monthUsed, resetAt? }`；未登录返回游客额度说明 |
| `GET /api/credit/history` | GET | 额度明细（用户友好文案） | 服务端把 ledger 翻译成「PDF 翻译 -320」「注册赠送 +500」，不暴露内部术语 |
| `GET /api/credit/estimate?feature=pdf&pages=100` | GET | 预计消耗 | 前端上传前调用，显示「预计约 X 额度」 |
| 各 translate API | POST | 业务入口 | 服务端内部：estimate → check → reserve → job（前端**不能**传价格/额度） |

### 5.2 管理侧（Admin 角色，独立鉴权）
| API | 方法 | 用途 |
|---|---|---|
| `GET /api/admin/credits/users` | GET | 用户列表（余额/已用/预留） |
| `GET /api/admin/credits/users/:id` | GET | 单用户 Ledger/Usage/Job 全览 |
| `POST /api/admin/credits/adjust` | POST | 调整额度（增/减/补偿），body 必须含 `{ userId, amount, reason }`，**强制产生 Grant + Ledger**，记录 adminId |

### 5.3 内部（不对外）
- `credit.reserve({userId, jobId, feature, units, idempotencyKey})`
- `credit.consume({userId, jobId, usage, actualCredits, idempotencyKey})`
- `credit.release({userId, jobId, idempotencyKey})`
- `credit.refund({userId, jobId, amount, reason, idempotencyKey})`

---

## 6. Pricing Rule Design（成本锚定草案，最终由商业决策拍板）

### 6.1 锚定
1 Credit = **$0.001 USD**（千分之一美元，便于换算与未来售卖）。
真实成本（现有配置）：DeepSeek in $0.28/M · out $1.1/M；GLM in/out $0.01/M；Google 免费。

### 6.2 草案定价表（可配置，`PricingRule` 表 seed）
| feature | unit | creditRate | 成本依据（≈） | 建议用户价 |
|---|---|---|---|---|
| text_translation | per_1000_chars | 2 | 1000 字符≈700 token 中英 ≈ $0.0005 | 2 credits（≈$0.002） |
| pdf_translation | per_page | 2 | 1 页≈500 in+300 out token ≈ $0.0004 | 2 credits（≈$0.002） |
| image_translation | per_image | 3 | OCR 免费 + 翻译 ≈ $0.0003 | 3 credits（≈$0.003） |
| subtitle_translation | per_minute | 1 | 1 分钟≈40 词≈120 token ≈ $0.0001 | 1 credit（≈$0.001） |
| doc_translation | per_1000_chars | 2 | 同文本 | 2 credits |
| web_translation | per_1000_chars | 2 | 同文本 | 2 credits |
| polish | per_1000_chars | 2 | 同文本 | 2 credits |
| blindtest | per_vote | 0 | 产品获客功能 | 0（免费） |

- `minCharge=1`，PDF `maxCharge=200`/文件（100 页封顶 200 credits，超量保护）
- 单位可后续按页数/字符实测校准；**价格变动只影响新任务**（UsageRecord 锁 pricingRuleVersion + appliedUnitPrice）

### 6.3 免费额度（注册赠送，通过 Grant 实现）
- 新用户注册：`BONUS +300 credits`（expiresAt = +30 天）——替代现有「每日文件数」心智
- 游客：不送额度，仍走「登录后免费额度」引导（登录即送，天然防滥用）
- 说明：**现有 PDF/字幕「每日文件数」限制在 Credit 上线后退役**，统一为额度制；页数保护并入 maxCharge 封顶

---

## 7. Concurrency Strategy（P0）

- **原子预留**（核心）：
  ```sql
  UPDATE "CreditAccount"
  SET "availableBalance" = "availableBalance" - $1,
      "reservedBalance" = "reservedBalance" + $1,
      "version" = "version" + 1
  WHERE "userId" = $2 AND "availableBalance" >= $1
  ```
  影响行数 = 0 → 余额不足；= 1 → 预留成功。**同一事务内写 Ledger + UsageRecord + Job**。
- **Grant 扣减**：`UPDATE "CreditGrant" SET "remainingAmount"="remainingAmount"-$1, "reservedAmount"="reservedAmount"+$1 WHERE id=$2 AND "remainingAmount">=$1`（同原子模式，先过期先选）
- **乐观锁兜底**：`CreditAccount.version` 字段 + `updateMany({ where: { id, version } })`，冲突重试（≤3 次）
- **事务边界**：一个 Job 的全部 credit 流转在单个 `prisma.$transaction` 内完成；跨表一致性由 DB 事务保证
- 并发测试目标：100 并发 reserve 80+80 于余额 100 → **恰好 1 个成功**，余额永不为负

---

## 8. Idempotency Strategy（P0）

- 每个操作携带 `idempotencyKey` = `${jobId}:${op}[:${seq}]`（如 `pdf_x1:consume`、`pdf_x1:consume:3`）
- **CreditLedger.idempotencyKey 唯一约束**：重复插入触发唯一冲突 → 捕获后返回「已处理」结果（幂等成功），绝不重复扣减
- 覆盖：Reserve / Consume / Release / Refund / Admin Adjust（admin 用 `adjust:${uuid}`）
- Worker 重试 / 网络重试 / 用户重复点击 → 全部收敛为一次有效操作
- 已结算 Job 再次收到 consume → 返回现有结算结果（job.creditState 检查）

---

## 9. Failure Recovery

| 场景 | 处理 |
|---|---|
| Worker 崩溃（job 卡 processing） | **扫描器**（每 5 分钟）：processing 超 30 分钟 → 标记 failed + Release 全部预留；已部分翻译且有译文 → Consume 实际 + Release 剩余（部分成功结算） |
| Job 超时（60s provider 超时降级后仍失败） | 失败 → Release 全部 |
| Consume 后才发现系统错误 | Refund（新 + 记录），不改原记录 |
| 网络重试 / 重复点击 | 幂等键收敛（§8） |
| 用户取消 | 未开始：Release 全部；进行中：按 UsageRecord 已实际消耗 Consume + Release 剩余 |
| 部分成功（如 100 页成功 80） | **Consume 成功部分**（按实际结算）+ Release 失败部分预留（对应 PDF 工具已记录每块成功/失败） |
| 预留后 Job 永远不结算 | 扫描器强制结算（Reserve 必须终结于 Consume 或 Release——核心不变量 #6） |
| 文本翻译同步请求失败 | 同步路径：reserve 即结算（先 reserve 后立即 consume/release），失败零残留 |

---

## 10. Reconciliation Strategy

- **每日对账 Job**（cron，凌晨）：
  1. `CreditAccount.available + reserved` vs `Σ CreditLedger`（按 userId）——不等 → 异常记录 + alert
  2. `Σ Grant.remaining + reserved` vs `CreditAccount` —— 不等 → 异常记录 + alert
  3. 未终结 Job 扫描：`creditState='reserved' 且超时` → 强制结算（§9）
  4. 过期 Grant：`expiresAt < now 且 remaining > 0` → 写 Ledger(type=expire) + remaining=0（**不 DELETE**，用户历史可解释）
- **发现 mismatch 不静默修复**：写 `ReconciliationRecord`（异常类型/差值/时间）+ 日志 alert，人工处理
- 监控项（§38 要求）：balance negative、consume without reserve、refund without consume、duplicate op、job completed 但未结算 → 全部 error log + alert

---

## 11.0 产品哲学：让用户「放心使用 AI」（最高 UX 原则）

额度系统的存在价值不是「卖积分」，而是**消除用户使用 AI 的顾虑**。用户不该被迫理解积分经济（消费顺序/过期/来源/定价），只该获得六项安心承诺——**每一项都必须真实兑现，文案即功能**：

| 用户潜在顾虑 | 系统承诺（真实行为，非话术） |
|---|---|
| 怕乱扣费 | 只有**成功完成**的翻译才扣额度；失败/取消自动退回，无需申请 |
| 怕翻译到一半没钱被卡 | 额度不足在**提交前**就拦截并说明，任务绝不半路失败 |
| 怕预估不准多花钱 | **按实际用量结算**（预估 500 实际 430 → 只扣 430），多退少补 |
| 怕不知道花了多少 | 每次使用后清晰可见「本次使用 X 额度」，历史不藏账 |
| 怕规则复杂 | 消费顺序/过期/来源全部后台处理，前台零规则教学 |
| 怕被营销打扰 | 低余额仅一次轻提示、可关闭，绝无弹窗轰炸与「额度快过期快用」式紧迫感营销 |

设计语言红线：
- 用词只允许：**使用额度 / 剩余额度 / 本次预计消耗 / 本月使用情况**
- 禁止：钱包、资产、账本、积分交易、财务账户等一切财务感词汇
- 禁止在前台解释：消费顺序、Grant、Reserve、Ledger、过期规则（后台有，前台不解释）
- 禁止「额度焦虑」营销：不诱导消费、不制造紧迫感；用户主动查看时如实展示到期信息即可

这条原则是 UX 验收的**第一检查项**：任何让用户产生「我在操作积分系统」感受的设计 = 不合格。

## 11. User UX（「后台复杂，前台简单」）

### 11.1 导航
- header 用户菜单显示「**额度**」入口（不长期显示数字，避免钱包感）；点击进 `/credit` 页——命名体现「还能放心用多少」而非「我有多少资产」
- 未登录：翻译后挽留条升级为「登录即送 300 额度」

### 11.2 额度页 `/credit`（3 秒看懂）
```
我的额度
剩余额度  8,320          [查看套餐]
本月已使用 1,680          下次恢复：9月1日

额度明细
今天  PDF 翻译        -320
今天  图片翻译        -40
昨天  注册赠送        +500

额度来源
免费额度（8/30 到期）   8,000
注册赠送（9/11 到期）     320
```
- 不显示 Ledger ID / Grant ID / Reserve / Consume 等术语
- 恢复时间**按真实规则**显示（BONUS 到期不显示「恢复」，FREE_MONTHLY 显示下月 1 日）

### 11.3 翻译操作前（预计消耗）
- PDF 上传后：`预计使用约 200 个额度 · 当前剩余 1,200 · 翻译后约剩 1,000` + [确认翻译]
- 前端通过 `GET /api/credit/estimate` 拿预估（服务端按 PricingRule 计算，**前端不算价**）

### 11.4 额度不足（不显示 402）
```
当前额度不足
本次翻译预计需要约 800 个额度，你当前还有 320 个。
[查看套餐] [获取更多额度]
```

### 11.5 低余额提醒（<20%）
- 页面内轻提示「你的翻译额度即将用完」+ 额度页角标；不弹营销窗，不每次翻译都弹

### 11.6 历史与失败（用户友好文案）
| 场景 | 展示 |
|---|---|
| 成功 | `PDF 翻译 · 成功 · 使用 320 个额度` |
| 失败（未扣） | `PDF 翻译 · 失败 · 未扣除额度` |
| 失败（已扣后系统错误） | `PDF 翻译 · 失败 · 本次使用额度已退回` |
| 部分成功 | `PDF 翻译 · 完成 80/100 页 · 使用 320 个额度` |
| 取消 | `已取消 · 未扣除额度`（未开始）/ `已取消 · 按实际使用结算` |

---

## 12. Admin UX（与用户页完全分离）

- `/admin/credits`：用户搜索（邮箱/昵称）→ 余额卡（available/reserved/granted/consumed/refunded/expired）
- 用户详情：Ledger 流水（原始）、Usage 列表（含 costUsd/模型/特征量）、Job 列表、对账状态
- 调整表单：`{ 用户, 金额(+/−), 类型(补偿/扣减/赠送), 原因必填 }` → 生成 Grant + Ledger，记录 adminId/时间/原因
- 对账报告页：历史 mismatch 记录 + 处理状态

---

## 13. 关键验收场景推演（对应任务 §46）

> 100 页 PDF 预计 500 credits，实际成功 430 页（实际成本 430 credits），worker 重启一次，用户重复点击一次：

```
1. 用户上传 → estimate(pages=100) = 500 → check balance → reserve 500
   （原子 UPDATE available-500 reserved+500；Ledger: -500 reserve；UsageRecord: reserved=500）
2. 重复点击（用户/重试）→ 幂等键 pdf_x1:reserve 已存在 → 返回已预留，不重复扣
3. worker 处理：中途重启 → job 仍 processing；重启后 worker 从 checkpoint 继续（幂等 consume）
4. 实际成功 430 页 → worker 调 consume(actual=430)
   → 按 Grant 顺序扣 430（先过期先消费）；Ledger: -430 consume；UsageRecord: consumed=430
   → release(70)：reserved-70, available+70；Ledger: +70 release
5. 最终：available 净变化 = -500+70 = -430；用户看到「翻译完成，本次使用 430 个额度」
6. 若 worker 崩溃后 430 页结果已产生但结算未跑 → 扫描器兜底结算（§9）
```
全程 Ledger 可完整解释余额：`+300 注册 → -500 reserve → -430 consume → +70 release`。

---

## 14. 架构决策记录（ADR）

| 决策 | 理由 |
|---|---|
| 1 Credit = $0.001 锚定 | 便于未来售卖/订阅定价与 unit economics |
| 所有功能统一走 Credit Engine，不建独立余额 | 用户原则「不要多余额」 |
| 消费顺序：先过期 → 免费/月度 → Bonus → 购买 | 防浪费；规则放 Consumption Policy 配置不硬编码 |
| Grant 拆分而非单余额 | 支持不同过期时间/来源追溯/未来订阅 |
| Ledger append-only + 幂等键唯一 | 审计与幂等合一 |
| 同步请求（文本/图片/网页/文档）reserve 即结算 | 无后台 worker，避免预留滞留 |
| 异步任务（PDF/字幕）完整 reserve→consume/release | 预估误差不向用户多收 |
| 部分成功按实际结算 | PDF 已有块级成功记录，可精确结算 |
| 删除账户额度 inactive + 审计保留 | 财务审计要求；不硬删 Ledger |
| 前端永不算价 | 客户端不可信原则（§30） |

> 实施顺序见 `03-migration-plan.md`。
