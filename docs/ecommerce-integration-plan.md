# AI 跨境电商工作台 · Final Development Plan v1.2

> v1.2 最终版 · 2026-08-14 · 8 项决策已全部拍板
> 状态：**已确认，可开工**（从 Phase 0 起）
> V1 = AI Listing Studio + 商品图片翻译 + Customer Assistant

---

## 〇、最终确认决议（8 项拍板）

| # | 决策项 | 拍板结果 |
|---|---|---|
| 1 | Credit Seed Pricing | 批准 V1 seed 值（product_enrich 3 / listing_generation 3 / listing_rewrite·translation 2 / image_ocr 1 / customer_translation 2 / customer_reply 3）。**配置化不硬编码**；Listing Generation 用「任务预估额度」UX，不暴露每千字单价 |
| 2 | LanguageRegistry | 批准提炼。**只做现有语言配置统一抽象**，不扩展成语言管理后台/术语库/企业语言包 |
| 3 | StorageService | 批准抽象。Development=LocalStorage；Production=S3-compatible（R2/S3/OSS，供应商由工程环境定）。业务层只依赖接口 |
| 4 | 文件访问鉴权 | 短期 Signed URL。请求文件→后端查权限→生成短期 URL→浏览器直连 Storage。**不公开永久 URL** |
| 5 | Export | 基础 Export 不等 Phase 5。Listing Studio 完成后即支持 Copy / TXT / CSV·JSON |
| 6 | Product/Project UX | **Product-first**。进入工作台看到「我的商品」；Project 仅作 DB 与未来组织能力，不强迫用户理解 |
| 7 | Storage 生命周期 | DB soft delete → 异步 cleanup job → Storage 删除。**不请求同步删大量文件** |
| 8 | Credit 不足 UX | Reserve 阶段直接拦截：显示「本次预计 XX / 当前可用 XX」+ [获取额度][取消]。**不先执行再扣费** |

---

## 一、V1 范围与不做清单

**V1 = 三个功能，无一例外接入统一 Credit 生命周期。**

| 功能 | 一句话 |
|---|---|
| AI Listing Studio | Quick/Advanced 建商品 + AI 提取 + 一次生成完整 Draft + Fact Validation + 逐字段编辑 + 版本 + 导出 |
| 商品图片翻译 | 上传 → OCR → 翻译 → 布局重建 → 预览 → 下载 |
| Customer Assistant | 客户消息翻译 + 意图 + AI 回复 + 语气档 |

**明确不做**：Review Analyzer、Competitor Analyzer、Amazon/Shopify 自动发布、订单/库存/物流/财务/广告/自动定价、自动抓取、ERP、复杂团队权限、复杂 BI、复杂版本控制 UI、独立余额体系、复制 User/Credit/Translation 体系。

---

## 二、Phase 0 · 地基

| 项 | 交付 |
|---|---|
| StorageService 抽象 | `src/lib/storage/storage-service.ts`（接口）+ `LocalStorageService`（Development）+ S3-compatible 接口预留 |
| Credit 定价配置化 | `prisma/seed-pricing.ts` 追加 7 条 feature 定价（表驱动，非硬编码）；复用现有 PricingRule |
| LanguageRegistry | `src/lib/language-registry.ts` 统一现有语言代码/名称/BCP47 映射（仅抽象，不做管理后台） |
| 结算封装 | 复用 `sync-settle.ts` / `engine.ts`，就位 Reserve→Execute→Consume/Release/Refund→Usage |
| 任务预估额度 | `estimateCredits(feature, units)` 前端接入，「任务预估额度」UX |

> Phase 0 只搭框架、seed 数据、抽象接口，不写业务页面；业务页面从 Phase 1 起，**每个收费功能首日接入 Credit**。

---

## 三、Storage Architecture

```
interface StorageService {
  upload(file, meta): Promise<{storageKey, url}>
  get(storageKey): Promise<Buffer|Stream>
  delete(storageKey): Promise<void>
  getSignedUrl(storageKey, ttlSeconds): Promise<string>
}
```

| 环境 | 实现 |
|---|---|
| Development | `LocalStorageService`：磁盘 `<root>/storage/<uuid>`，storageKey=相对路径 |
| Production | `S3CompatibleStorageService`：R2 / S3 / OSS（S3 API 兼容，供应商由工程环境决定） |

**访问鉴权（Signed URL）**：
1. 前端请求文件 → 后端校验 userId + Project 归属权限
2. 后端生成短期 Signed URL（建议 15 分钟 TTL）
3. 浏览器直连 Storage 下载
4. 不公开永久 URL，Storage bucket 不设公开读

**生命周期（soft delete → async cleanup）**：
1. 用户删除 Product/Asset → DB `status=deleted` / `deletedAt`（soft delete）
2. 异步 cleanup job（cron）扫描软删记录 → 删除 Storage 文件 → 硬删 DB 记录
3. 用户请求内**不同步删大量文件**

---

## 四、Credit Architecture

- **配置化**：定价存 `PricingRule` 表（seed upsert），代码只读表，不硬编码单价。
- **前端展示**：只显示「预计使用 X 额度」「本次使用 X 额度」，**不显示 token / 模型成本 / 内部账本**。
- **Listing Generation UX**：以「任务预估额度」呈现——生成前调 estimate 返回本次任务预计额度，不暴露「每 1000 字符多少钱」。
- **Reserve 阶段拦截**（决策 8）：
  1. 提交前 estimate 展示预计额度
  2. 提交时 `reserve` 原子检查余额（行锁）
  3. 不足 → 402，前端弹「本次预计需要 XX Credits / 当前可用 XX Credits」+ [获取额度] [取消]
  4. **绝不先执行再扣费**
- **生命周期**：同步任务 `beginSync→execute→endSyncSuccess/endSyncFail`；异步任务 `reserve→EcommerceJob→consume/refund`；幂等 `idempotencyKey=jobId:op[:seq]`。

| feature | V1 seed rate | 计量 |
|---|---|---|
| product_enrich | 3 | /千字 |
| listing_generation | 3 | /千字 |
| listing_rewrite / listing_translation | 2 | /千字 |
| image_ocr | 1 | /张 |
| customer_translation | 2 | /千字 |
| customer_reply | 3 | /千字 |

---

## 五、Product UX（Product-first）

- 用户进入工作台 `/ecommerce` 直接看到「**我的商品**」列表，不先理解 Project。
- 主链路：**创建商品 → 商品工作区 → Listing / Images / Messages Tab**。
- 创建商品：Quick Mode（名称+描述 → AI 提取补全）或 Advanced Mode（SKU/Brand/Materials/Dimensions/Weight/Specifications）。
- Project 仅作为 DB 归属字段 + 未来组织能力（多商品归类），默认自动归属「默认项目」，不暴露给普通用户。

---

## 六、Export

Listing Studio 完成后即支持（不等 Phase 5）：

| 导出 | 说明 |
|---|---|
| Copy | 单字段/全文复制到剪贴板 |
| TXT | 纯文本 Listing 导出 |
| CSV / JSON | 按实际结构选择（推荐 JSON 保留字段+版本；CSV 供表格处理） |

闭环：**Generate → Edit → Save → Export** 在 Phase 2 内完整可用。

---

## 七、Acceptance Criteria

1. 登录 → 建商品（Quick：名称+描述）→ AI 提取补全字段 → Amazon US → 一次生成完整 Draft（Title/Bullet Points/Description/Keywords/FAQ-Highlights 齐全）→ 逐字段编辑 → 保存 → **Copy/TXT/CSV·JSON 导出** → 扣费正确。
2. 上传图片 → OCR → 翻译 → 布局重建预览（文案「尽可能保持原始布局和视觉结构」）→ 下载（经 Signed URL）。
3. 英文客户消息 → 中文翻译 → 意图 → AI 回复 → 改语气 → 复制。
4. **额度不足 UX**：Reserve 阶段拦截，显示「本次预计 XX / 当前可用 XX」+ [获取额度][取消]，不先执行不扣费。
5. Provider 失败 → FAILED → Reserve 自动 Refund → 友好提示。
6. 重复点击 → 不重复建任务、不重复扣费（幂等）。
7. 用户 A 不能访问用户 B 的 Product/Asset/Message（IDOR 全拦）。
8. 文件访问走短期 Signed URL，无永久公开 URL；删除走 soft delete → cleanup，不请求同步删文件。

---

## 八、分阶段开发顺序（v1.2）

| 阶段 | 内容 | Credit |
|---|---|---|
| Phase 0 | StorageService + Credit 定价 seed + LanguageRegistry + 结算封装 | 框架就位 |
| Phase 1 | Product-first 工作台 + Quick/Advanced 建商品 + AI 提取 + 权限/IDOR | AI 提取首日接入 |
| Phase 2 | Listing Studio：一次生成 Draft + Fact Validation + 编辑 + 版本 + **Export（Copy/TXT/CSV·JSON）** | 全接入 |
| Phase 3 | 图片翻译：上传 → OCR → 翻译 → 布局重建 → 预览 → 下载（Signed URL） | 全接入 |
| Phase 4 | Customer Assistant：翻译 + 意图 + 回复 + 语气 | 全接入 |
| Phase 5 | QA：场景 1–8 + 移动端 + 安全 + cleanup job | 校验 |

---

## 九、开工前检查清单

- [x] 8 项决策拍板（本版）
- [x] V1 范围锁定（3 功能）
- [x] Credit seed 定价 + 配置化方案
- [x] StorageService 接口 + Dev/Prod 实现方案
- [x] Signed URL 鉴权流程
- [x] Product-first UX 定案
- [x] Export 提前到 Phase 2
- [ ] 服务器 Storage 磁盘路径/容量确认（Phase 0 实施时）
- [ ] S3-compatible 供应商选定（Production 切换时，可后置）

> v1.2 已确认，可开工。
