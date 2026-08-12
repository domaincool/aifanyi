# aifanyi.com · Credit & Usage System — 01 现状审计

> 审计日期：2026-08-12 · 审计人：全栈工程师（agent-nc6bvi）
> 审计范围：全部翻译功能（文本/PDF/图片/字幕/Word-PPT/网页/润色/盲测）、数据库、额度、成本、用户体系
> 结论先行：**当前没有统一 Credit System。** 已有 CreditAccount/CreditLedger 空表（schema 预留但零业务引用），实际额度 = 各工具各自为政的「每日免费文件/页数计数」，单位混乱、无原子性、无幂等、无 reserve/consume 生命周期。

---

## 1. CURRENT CREDIT ARCHITECTURE（现状额度架构）

### 1.1 身份三档（已生产化）
| 标识 | 含义 | 用途 |
|---|---|---|
| `userId` | 登录用户（Google/Email，Unified User） | 登录用户额度统计维度 |
| `guestSessionId` | guest cookie（30 天） | 游客任务归属、登录后迁移 |
| `clientKey` | IP+UA SHA-256（32 hex） | 防滥用维度（游客额度计数） |

### 1.2 各功能额度现状（单位混乱）
| 功能 | 额度机制 | 计数表 | 计量单位 | 认证要求 |
|---|---|---|---|---|
| 文本翻译 | **无**（仅限流） | — | — | 无 |
| AI 润色 | **无** | — | — | 无 |
| PDF | 登录 5 文件/日 + 50 页/日；游客 1 文件/日 + 10 页/日 | PdfJob count + pageCount aggregate | files + pages | 可选（游客可用） |
| 字幕 | 5 文件/日（IP+UA） | SubtitleJob count | files | 可选 |
| 图片 | **无** | — | — | 无 |
| Word/PPT | **无**（仅 10MB/300 段硬限） | — | — | 无 |
| 网页 | **无**（仅 4MB/50 段硬限） | — | — | 无 |
| 盲测擂台 | 无（投票防重靠 ipHash） | Vote | — | 无 |

### 1.3 现有表（与 Credit 相关）
- `CreditAccount`（id/userId/balance/createdAt/updatedAt）— **schema 存在，业务代码零引用（空壳）**
- `CreditLedger`（id/userId/type/amount/description/createdAt）— **schema 存在，仅删除账户时被 deleteMany 清理**
- `UsageLedger`（id/userId/guestSessionId/type/amount/unit/taskId/description/createdAt）— **唯一被业务使用的账本，但语义 =「文件计数」**（PDF 上传时 +1 files），非额度计量
- `PdfJob`/`SubtitleJob`：记录 `totalCostUsd`（美元真实成本，供统计）、status/progress/errorType
- `TranslationJob`：文本翻译记录 `costUsd` + tokens（仅统计，不向用户计费）

### 1.4 成本记录（真实 AI 成本已可追溯）
- PDF/字幕/文本：`totalInputTokens / totalOutputTokens / totalCostUsd`（DeepSeek $0.28/M in · $1.1/M out；GLM $0.01/M；Google 免费额度内 $0）
- 图片：不记录成本（GLM-4V-Flash 免费 OCR）
- 网页/文档/润色：不记录成本（纯翻译调用，无 UsageRecord）

### 1.5 配置化点
- `PDF_CONFIG.quota`：dailyFiles/dailyPages/guestDailyFiles/guestDailyPages/maxConcurrent（env 可覆盖）
- 字幕 5 文件/日硬编码在 `subtitle-job.ts`（非配置化）
- `/api/account/usage` 里 `dailyLimit = 50` **硬编码**（且与 PDF 的 dailyPages=50 语义混淆：展示的是文件数）

---

## 2. CURRENT USAGE FLOW（现状使用流程）

### 2.1 PDF（最完整的现有流程）
```
上传 PDF
  → parsePdf（大小/页数/字符限制校验）
  → 认证注入（sessionToken → userId；否则 guest cookie）
  → checkPdfQuota（非原子：count + aggregate 查询当日文件数/页数）
      → 超限返 429「今日免费额度已用完」
  → checkGlobalDailyCap（全站 200 文件/日）
  → createPdfJob（status=queued, expiresAt=24h）
  → UsageLedger +1 files（记账）
  → startPdfJob（后台 worker）
      → worker 分批翻译（DeepSeek 主 → 60s 超时 → 降级 GLM）
      → 累计 totalCostUsd / tokens
  → completed（progress=100）| failed（errorType + errorMessage）
```
特点：**先建任务后翻译，翻译期间无额度预留**；quota 检查与任务创建之间无原子性（并发可超发）；失败不涉及扣费（因为从未扣过）。

### 2.2 字幕
```
上传 SRT/VTT → checkSubtitleQuota（clientKey 当日 count < 5）→ 建 SubtitleJob → worker 翻译 → 累计成本
```
同样无预留、无原子性。

### 2.3 图片 / Word-PPT / 网页
```
上传/URL → 直接翻译（无额度、无认证、无 usage 记录）
```
**成本漏洞**：这三个接口任何人可无限调用（受限于单次 5MB/10MB/4MB 与超时），无身份、无日限额。

### 2.4 文本 / 润色
```
POST /api/translate → 翻译/润色 → TranslationJob 落库（含成本）→ 缓存命中跳过
```
无额度概念（缓存命中不产生成本，直连模型才计费）。

---

## 3. CURRENT PROBLEMS（问题清单，编号供架构引用）

| # | 严重度 | 问题 | 影响 |
|---|---|---|---|
| P1 | 高 | CreditAccount/CreditLedger 空壳，schema 有但零业务引用 | 无统一余额事实源 |
| P2 | 高 | 各功能额度单位混乱（files/pages/无） | 无法统一 UX「我还有多少额度」 |
| P3 | **高** | 图片/网页/Word-PPT **无认证、无额度、无 usage 记录** | 可被无限调用，AI 成本失控；无数据支撑 unit economics |
| P4 | 高 | 无 Reserve/Consume/Release/Refund 生命周期 | 异步任务（PDF/字幕）期间余额不可预测；失败/取消无结算语义 |
| P5 | 高 | 无幂等（重复点击、网络重试会创建重复 Job） | 重复任务、重复成本 |
| P6 | 高 | Quota 检查非原子（count+aggregate 无锁），并发可超发 | 免费额度可被并发耗尽/超卖 |
| P7 | 中 | UsageLedger 语义 =「文件计数」，account/usage 接口 limit 硬编码 50 且与 PDF quota 配置不同步 | 用户看到的「额度」展示与实际限制不一致 |
| P8 | 中 | 无 Pricing Rule / 版本 | 无法调价、历史不可追溯 |
| P9 | 中 | 无额度 UX（预计消耗/不足/低余额/恢复时间/获取更多） | 用户无法预判与决策 |
| P10 | 中 | 无 Admin 调整额度通道 | 客服补偿只能改库 |
| P11 | 中 | 删除账户 `deleteMany` 硬删 UsageLedger/CreditLedger | 违反审计数据保留原则（用户删除前至少应匿名化/归档） |
| P12 | 低 | 部分成功无结算规则（PDF 80/100 页成功时如何计费未定义） | 未来计费无依据 |
| P13 | 低 | 无对账/监控（余额与流水一致性无校验） | 静默错误不可发现 |

---

## 4. 审计结论

1. **不要推倒重来**：身份体系（userId/guestSessionId/clientKey）、Job 状态机（queued/processing/completed/failed）、成本记录（totalCostUsd/tokens）、配置化模式（PDF_CONFIG）都是可复用的正确积木。
2. **要新建**：统一 Credit Engine（Reserve/Consume/Release/Refund + 幂等 + 锁）、CreditGrant、UsageRecord、PricingRule、额度 UX、Admin/对账。
3. **要改造**：CreditAccount/CreditLedger 启用；image/doc/web 补认证+额度+usage；删除账户策略改为「额度失效 + 审计保留」。
4. **定价前提**：现有真实成本可计算（DeepSeek $0.28/$1.1 per M token；GLM $0.01；OCR 免费），Credit 定价可做成本锚定（详见 02-architecture 第 6 节）。

> 下一步见 `02-architecture.md`（Target Architecture 12 项）+ `03-migration-plan.md`（分阶段实施）。
