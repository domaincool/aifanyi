# Creem 支付上线清单（凭据到达后 10 步）

> 前置状态（2026-08-17）：支付代码已就绪（`src/lib/payment/providers/creem.ts` + `src/app/api/credits/webhook/[provider]/route.ts`），
> 5 个凭据（CREEM_API_KEY / PRODUCT_STARTER / PRODUCT_STANDARD / PRODUCT_PRO / WEBHOOK_SECRET）未到，PAYMENT_PROVIDER 未配。
> 本文档是凭据到达后的执行清单。每一步都给出验证方式；全部完成后即可 live。

服务器路径约定：`/opt/aifanyi`（部署脚本 `scripts/deploy.sh`），本地开发 `G:\autoclaw\aifanyi`。

---

## Step 0 · 客服通道就绪（可在等凭据期间完成）
- [ ] 确认 `support@aifanyi.com` 邮箱可收发邮件（或在邮箱服务商将该地址转发到现有运营邮箱）
- [ ] 上线 Terms 退款政策页（`src/app/terms/page.tsx` 已含退款政策小节）
- [ ] 页脚「联系我们」指向 `mailto:support@aifanyi.com`；积分页充值区显示客服邮箱

## Step 1 · 填 .env（5 个凭据）
- [ ] 从 Creem Dashboard 取得 5 个值，填入服务器 `.env` 与本地 `.env`：
  - `CREEM_API_KEY`（Developers → API Keys；测试 `creem_test_` 开头 / 生产 `creem_live_` 开头）
  - `CREEM_PRODUCT_STARTER` / `CREEM_PRODUCT_STANDARD` / `CREEM_PRODUCT_PRO`（Products 页各 SKU 的 product id）
  - `CREEM_WEBHOOK_SECRET`（Developers → Webhook）
- [ ] ⚠️ 先只填 **测试环境**（test mode）的 key 和商品 id，不要碰生产 key

## Step 2 · 本地就绪检查
```bash
# 服务器（/opt/aifanyi）或本地（G:\autoclaw\aifanyi）
npx tsx scripts/creem-ready-check.ts
```
- [ ] 期望输出：5 项凭据齐全 ✓；三档 PricePlan 与 seed 常量一致 ✓
- [ ] 有缺失/不一致：按脚本提示补齐后重跑，直到退出码 0

## Step 3 · Dashboard 三 SKU 比对（人工）
- [ ] Products → 三个一次性商品（Single payment），美元定价：
  | code | 名称 | 价格 | 对应 .env |
  |---|---|---|---|
  | starter | 入门包 | $1.49 | CREEM_PRODUCT_STARTER |
  | standard | 主力包 | $4.99 | CREEM_PRODUCT_STANDARD |
  | pro | 重度包 | $13.99 | CREEM_PRODUCT_PRO |
- [ ] 商品价格与 PricePlan 表逐一对上（防 SKU 错配）
- [ ] 记录测试环境与生产环境的 product id 各自独立（环境不同商品不同）

## Step 4 · 配 Webhook
- [ ] Developers → Webhook → 新建：URL `https://aifanyi.com/api/credits/webhook/creem`
- [ ] 事件勾选：`checkout.completed`（必选）；`refund.created` 暂不勾（退款处理代码未就绪，退款走人工客服）
- [ ] 复制 Webhook Secret 填入 `.env`
- [ ] 测试环境 webhook URL 可先用 ngrok 指向本地调试（docs.creem.io 测试模式支持）

## Step 5 · 开启渠道 + 重启
- [ ] 服务器 `.env`：`PAYMENT_PROVIDER=creem`
- [ ] 重启：本地 `npm run dev`；服务器 `bash scripts/deploy.sh`（或 pm2 restart）
- [ ] 验证：`GET /api/credits/plans` 200；积分页「购买」按钮不再提示「支付渠道暂未开通」

## Step 6 · Test 小额实测（测试环境）
- [ ] 登录一个测试账号 → 积分页点「购买」入门包
- [ ] 跳转 `checkout.creem.io`（测试环境）→ 用测试卡 **4242 4242 4242 4242**（任意未来有效期/CVV）完成支付
- [ ] 支付后跳回 `https://aifanyi.com/credit?paid=<orderId>`，页面轮询「正在确认到账」
- [ ] 验证链路：
  ```bash
  # 服务器查订单
  /usr/local/pgsql/bin/psql -U aifanyi -d aifanyi -c "SELECT id,plan_code,status,provider,provider_order_id,granted_at FROM \"RechargeOrder\" ORDER BY created_at DESC LIMIT 3;"
  ```
  - [ ] 订单 status=`granted`、provider=`creem`、provider_order_id 有值
  - [ ] 用户积分 +1000；账本记录 grant（无重复入账，幂等 ✓）
- [ ] 用「卡片被拒」测试卡验证失败路径不产生订单/积分

## Step 7 · Webhook 自测（安全）
- [ ] Dashboard → Developers → 手动 Resend 一次 `checkout.completed` 事件 → 订单幂等处理（重复事件不重复加积分）
- [ ] 伪造签名测试：`curl -X POST https://aifanyi.com/api/credits/webhook/creem -H 'creem-signature: deadbeef' -d '{}'` → 期望 401
- [ ] 缺签名测试：不带 `creem-signature` → 期望 401
- [ ] 错误 provider 路径 `.../webhook/xxx` → 期望 404
- [ ] 服务器日志无异常堆栈；webhook 正常事件返回 200

## Step 8 · 观察对账（1-2 天）
- [ ] `GET /api/stats`：盲测/翻译调用正常，无异常
- [ ] 检查 `CreditLedger` 与 `CreditAccount.balance` 对账不变量：`available + reserved == ΣLedger.amount`
- [ ] 观察 Creem Dashboard 交易与本地订单一一对应（金额、时间）
- [ ] 若出现 webhook 未收到（重试 5 次后仍失败）：检查防火墙/Nginx 对 POST 的放行、HTTPS 证书有效性

## Step 9 · 切换 live（生产）
- [ ] 换 `creem_live_` 生产 key + 生产环境 3 个 product id（重新跑一遍 Step 2 脚本确认环境识别为生产）
- [ ] Dashboard 确认生产环境 webhook URL 已配（生产与测试 webhook 独立）
- [ ] 自己真实买一笔 $1.49（真实卡）走通全链路：checkout → 跳回 → 到账 → 退款测试（可选，走客服人工退）
- [ ] 验证生产 key 前缀 `creem_live_` 且下单打到 `api.creem.io`

## Step 10 · 全量放开
- [ ] 积分页「支付渠道接入中，暂不支持在线充值」文案移除（CreditClient.tsx）
- [ ] README / 上线公告更新：充值功能上线
- [ ] 监控：webhook 失败率、订单 pending 卡单、退款工单响应时效（客服邮箱）
- [ ] （P2 后续）`refund.created` 自动退款处理：待拿到真实退款 payload 后确认关联字段（见 ready/README.md 不确定项 1），再实现自动退积分 + 勾选 refund.created 事件

---

## 回滚预案
- 任一步异常：`PAYMENT_PROVIDER` 改回空（或 mock）→ 重启 → 恢复「支付渠道暂未开通」提示，数据不受影响
- 订单卡 pending 超过 15 分钟：订单自动过期，用户可重新下单；webhook 补偿机制（Dashboard 手动 resend）
