# aifanyi.com · Credit & Usage System — 03 Migration Plan

> 原则：分阶段落地，每阶段可独立部署验证、可回滚；不一次性大爆炸。
> 每阶段包含：改动范围 / 风险 / 验证方式。实施前需用户确认定价草案（§6）。

---

## 阶段 0 — 基线冻结与定价确认
- [ ] 冻结现有功能（本次只加不动，PDF/字幕旧额度保留至 Credit 上线切换）
- [ ] **用户确认定价草案**（02 §6.2）：1 Credit=$0.001；PDF 2/页；文本 2/千字；图片 3/张；字幕 1/分钟；文档/网页/润色 2/千字；盲测 0
- [ ] 确认免费策略：新用户注册送 300（30 天有效）；是否保留游客 1 文件/日（建议 Credit 上线后游客引导登录，不送额度）
- 风险：无（纯决策）

## 阶段 1 — Schema + PricingRule seed
- [ ] 新建 `CreditGrant` / `UsageRecord` / `PricingRule`；`CreditLedger` 加 `grantId/usageId/jobId/idempotencyKey`（唯一）
- [ ] `CreditAccount` 加 `reservedBalance/version`；PdfJob/SubtitleJob/TranslationJob 加 `creditState/reservedCredits/consumedCredits/pricingRuleVersion`
- [ ] seed `PricingRule` 8 条（草案价）
- [ ] `prisma migrate` + `db push` 验证
- 风险：低（纯新增字段，旧代码不感知）
- 验证：`prisma migrate status` 全绿；新表可读写

## 阶段 2 — Credit Engine 核心库
- [ ] `src/lib/credit/engine.ts`：reserve / consume / release / refund / grant / expire
- [ ] 原子 UPDATE + version 乐观锁 + 幂等键唯一约束冲突捕获
- [ ] `src/lib/credit/pricing.ts`：estimate（按 feature + 特征量查 PricingRule）
- [ ] `src/lib/credit/policy.ts`：消费顺序（先过期先消费，配置化）
- [ ] 单测：余额不足 / 并发 / 幂等（本地脚本 + 测试库）
- 风险：中（核心逻辑，先行单测再接线）
- 验证：`npm test` 或独立测试脚本 24 场景覆盖（02 任务 §40）

## 阶段 3 — 堵成本漏洞：image / doc / web 补认证 + usage + 额度
- [ ] 三个 API 接入 session 校验（游客可用的策略与 PDF 对齐：未登录允许但计数，或直接要求登录）
- [ ] 各接口调用 credit.reserve → 同步翻译 → consume 实际 / release（失败）
- [ ] 写 UsageRecord（imageCount / paragraphCount / characters）
- 风险：中（行为变化：未登录用户可能被限；需文案引导）
- 验证：三接口未登录/登录各跑通；余额变化正确；重复请求幂等

## 阶段 4 — 异步任务接入（PDF / 字幕）
- [ ] 上传 → estimate → reserve（原子）→ 建 Job（带 creditState）
- [ ] worker 结算：成功 consume 实际 + release 剩余；失败 release；部分成功 consume 成功部分 + release 失败部分
- [ ] 取消任务 API（前端加取消按钮）：未开始 release 全部 / 进行中按已用结算
- [ ] 扫描器：processing 超时强制结算 + 过期 Grant 到期（每日 cron）
- 风险：高（核心业务改造；需要回归全部 PDF/字幕流程）
- 验证：E2E 上传真实 PDF（成功/失败/取消/并发重复点击）；对账一致

## 阶段 5 — 文本 / 润色 / 盲测接入
- [ ] 文本与润色：同步 reserve→consume（缓存命中不扣）；失败 release
- [ ] 盲测：保持 0 credits（产品获客），但写 UsageRecord（feature=blindtest）供统计
- 风险：低
- 验证：翻译缓存命中/未命中余额变化正确

## 阶段 6 — 用户 UX
- [ ] `GET /api/credit/balance` + `GET /api/credit/history`（用户友好文案层）
- [ ] `/credit` 页（剩余/本月/明细/来源/恢复时间，3 秒看懂）
- [ ] 上传前 `estimate` 提示「预计约 X 额度 · 当前剩余 Y · 翻译后约剩 Z」
- [ ] 不足拦截（友好文案 + [查看套餐]）；低余额轻提示（<20%）
- [ ] header 用户菜单「额度」入口；历史页（Job 列表显示使用额度 + 失败退回文案）
- [ ] 退役旧「每日文件数」额度文案（PDF/字幕），统一额度制
- 风险：中（前端多处改动）
- 验证：浏览器全流程走查（登录/游客、足额/不足、成功/失败/取消）

## 阶段 7 — Admin + 对账 + 监控
- [ ] `POST /api/admin/credits/adjust`（admin 鉴权 + 必填 reason + Grant/Ledger 落库）
- [ ] `/admin/credits` 页面（用户列表/明细/调整表单/对账报告）
- [ ] 每日对账 cron（§10）+ `ReconciliationRecord` 表 + 异常 alert
- [ ] 监控项埋点（§38 清单：balance negative / ledger mismatch / reserved stuck / duplicate op…）
- 风险：低（独立模块）
- 验证：调整额度 → 余额/流水/对账一致；人为制造 mismatch 触发告警

## 阶段 8 — 删除账户策略调整
- [ ] 删除账户：Sessions revoke + CreditGrant/CreditAccount 置 inactive + 任务权限 revoke；**Ledger 保留（匿名化 userId）**
- 风险：低
- 验证：删除后原账号不可登录、余额归零、对账不报错

## 阶段 9 — 全量回归 + 文档
- [ ] 24 场景测试（任务 §40 清单）全绿
- [ ] 对账跑批 7 天无 mismatch
- [ ] 文档：`docs/credit-system/04-implementation.md`（API 清单/表结构/运维手册/已知限制）
- [ ] 上线公告文案（额度制上线，用户可见变更说明）

---

## 回滚策略
- 阶段 1-2 纯新增，可随时停（旧额度逻辑未动）
- 阶段 3-5 接线后：如发现问题，开关 `CREDIT_ENGINE_ENABLED=false` 回退旧逻辑（功能开关），余额数据保留
- 阶段 6 UX 可独立回滚（页面级）

## 预估工作量
| 阶段 | 估时 | 依赖 |
|---|---|---|
| 0 定价确认 | 决策 | 用户 |
| 1 Schema | 0.5d | — |
| 2 Engine 核心 | 1-1.5d | 1 |
| 3 成本漏洞 | 1d | 2 |
| 4 异步接入 | 1.5-2d | 2 |
| 5 文本/润色 | 0.5d | 2 |
| 6 UX | 1.5d | 4/5 |
| 7 Admin/对账 | 1d | 2 |
| 8 删户策略 | 0.5d | 2 |
| 9 回归+文档 | 1d | 全部 |
| **合计** | **~9-10d** | |

> 建议：阶段 3（成本漏洞）与阶段 4（异步核心）优先，它们直接消除 P3/P4/P5/P6 高风险项。
