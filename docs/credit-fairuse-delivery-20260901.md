# 公平使用制改造交付说明（credit-fairuse-20260901）

- 日期：2026-09-01
- 决策来源：handoff `credit-fairuse-handoff-20260901.md`（用户已拍板，运营确认开工）
- 状态：✅ 已实现 + 本地 build 通过 + 本地冒烟通过（待用户确认后部署）

## 改动总览（36 文件修改 + 2 新文件）

### 后端

**B1 CREDIT_DEDUCTION feature flag（默认 off = 暂停扣费）**
- 新文件 `src/lib/credit/feature-flags.ts`：`isCreditDeductionEnabled()`，读 env `CREDIT_DEDUCTION`（`'on'` 恢复旧行为）
- `src/lib/credit/sync-settle.ts`：beginSync/endSyncSuccess/endSyncFail 三函数加 flag 判断
  - off：beginSync 直接放行（不 reserve、不检查余额、不产生「余额不足」拦截）；endSyncSuccess 空转（不 consume）；endSyncFail 空转（无预留可退）
  - on：完整恢复旧行为（reserve→consume/release）
- 注册 300/500 赠送逻辑不动（credit/balance 懒触发照发）
- 回退：env `CREDIT_DEDUCTION=on` 一键恢复，无需改代码

**B2 双阈值 + 游客限额（配置化，不硬编码）**
- 新文件 `src/lib/fairuse-quota.ts`：
  - 游客（clientKey）：日 5 文件 / 50 页（env：FAIR_USE_GUEST_FILES / FAIR_USE_GUEST_PAGES）
  - 登录：日 10 文件 / 100 页硬阈值（FAIR_USE_LOGIN_FILES / FAIR_USE_LOGIN_PAGES）
  - 登录软阈值：日 5 文件 / 50 页，仅打点 UsageLedger（type=fair_use_soft），用户无感（FAIR_USE_SOFT_FILES / FAIR_USE_SOFT_PAGES）
  - 硬阈值超限 → 429 + 错误码 `fair_use_limit_reached` + 语义化文案（登录「为保障所有人稳定使用，今日已达公平使用上限，明日自动恢复。」/ 游客「今日免费额度已用完，免费注册即可解锁双倍每日额度。」）
  - 文件口径：PdfJob + SubtitleJob + UsageLedger(image/doc/web) 当日计数；页数口径：PdfJob pageCount
- 接入 5 个文件类 API：pdf/subtitle/image/doc/web translate route（认证后、reserve 前）
- clientKey 日 200 全站熔断（checkGlobalDailyCap）保留兜底（B3 结论：全站聚合口径，非 per-key）

**D1 用户日用量分布（/api/stats 新增 fairUse.distribution）**
- 今日登录用户/游客（clientKey）的文件数 + PDF 页数分布：p50/p95/p99，分登录/游客两组

**D2 观察名单（/api/stats 新增 fairUse.watchlist）**
- 软阈值以上用户清单 + 日用量（文件数/页数 + 阈值参照），附邮箱，按文件数降序

### 前端（F 系列）

- **F1** 上传页/结果页移除全部「本次将扣除 X 积分」「积分不足」「退回积分」标注：
  - PDF/字幕取消按钮、paused 提示、resume 失败文案；voice 气泡/桌面/移动端预计与本次积分显示；ecommerce 全组件结果 toast；TranslatorBox 预计积分块删除
- **F2** 导航栏「我的积分」入口移除 → UserMenu 改为「我的用量」（指向 /account?tab=usage）；余额资产保留在个人中心深处（/credit 与 account usage tab 不动）
- **F3+F7** 登录弹窗改版：主文案「免费注册，解锁双倍每日额度」，收益点「免费使用，每日额度翻倍」；PDF/字幕 401 文案同步「免费注册解锁双倍每日额度」
- **F4** PDF FAQ「免费吗？」改公平使用说明（游客 5 文件/50 页、注册 10 文件/100 页、每日重置）；tools 页卡片 desc 去「免费积分」
- **F5** 首页 hero 加「🎁 免费使用」徽章（新 CSS .hero-free-badge）+ 副文案「无需付费，上传即译」；工具区 lead 改「全部免费使用」；首页 title/desc 加「免费」
- **F6** 上传拖拽区：FileTranslator 计费参考 →「免费 · 无需注册即可开始」；字幕上传区「积分制」→「免费使用」
- **F8** PDF 完成摘要移除成本字段（保留耗时/失败块数；成本埋点 page.tsx track 保留不动）
- **F9** 导航未登录 CTA「登录 / 注册」→「免费注册」（桌面 + 移动端）
- **SEO** 首页 + 5 工具页 title/description 加「免费」修饰（仅工具页与首页，内容页未动）

### 文案红线核对（本地冒烟实测）

- 首页 / 6 工具页 / voice / tools / account 主流程 HTML：**零「积分」字样** ✅（本地 build 后逐页 HTTP 验证）
- 个人中心（/credit 积分页、/account usage tab）与 admin/条款页保留「积分」字样（handoff 唯一例外）
- 后端代码注释/内部字段保留「积分」技术术语（不影响前端展示）

## 阈值配置（env，默认值 = 用户拍板值）

| env | 默认 | 含义 |
|---|---|---|
| CREDIT_DEDUCTION | (未设=off) | on 恢复积分扣费 |
| FAIR_USE_GUEST_FILES / _PAGES | 5 / 50 | 游客日上限 |
| FAIR_USE_LOGIN_FILES / _PAGES | 10 / 100 | 登录硬阈值 |
| FAIR_USE_SOFT_FILES / _PAGES | 5 / 50 | 登录软阈值（打点） |

## 验证情况

- ✅ `tsc --noEmit` 全绿
- ✅ `next build` 通过（BUILD_ID 生成）
- ✅ 本地 start 冒烟：首页 200 + hero-free-badge 渲染 + 免费注册 CTA + 零积分字样；9 个页面全 200 零积分
- ✅ API 认证路径：/api/pdf/translate 未登录 401（文案已更新）
- ⏳ 待部署后线上验证：真实翻译任务零扣费流水、新注册赠送到账、stats fairUse 段数据、软阈值打点

## 待办

1. **用户确认后部署**（MEMORY.md 红线：生产部署先验收确认，等用户点头）
2. 游客文件工具开放（拍板 A/B）：若 A，需放开 PDF/字幕 401 + guestSessionId 逻辑，fairuse 游客线即生效（代码已就绪）
3. 部署后运营验收清单（handoff 内）：grep 无积分外露 / 触线文案模拟 / flag off 零扣费流水 / D1/D2 数据可见 / 预发回退演练
