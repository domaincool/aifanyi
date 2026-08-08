# aifanyi.com

AI 翻译，爱翻译。三角战略落地：**跨境电商翻译工作台+ 盲测擂台/梗翻译（吸流）+ 社区/纠错数据（壁垒）**。

## 技术栈

- Next.js 15 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma
- 翻译路由器内核：DeepSeek 主路由 / GLM 备选 / Google 翻译保底（OpenAI/Claude 预留）
- 部署：阿里云 FC nextjs 环境（阶段一香港节点免备案，阶段二迁国内）

## 快速开始

```bash
npm install
cp .env.example .env   # 填入 DATABASE_URL 和 API Key
npx prisma db push     # 建表
npm run db:seed        # 灌梗词条种子数据
npm run dev            # http://localhost:3000
```

## 目录结构

```
src/
├─ app/                 # App Router 页面 + API
│  ├─ api/translate     # 翻译路由器入口（缓存/成本计量/语料入库）
│  ├─ api/blindtest     # 盲测创建 + 列表
│  ├─ api/votes         # 投票（匿名映射解析 + 防刷 + 语料质量分）
│  ├─ blindtest/        # 盲测擂台页
│  └─ meme/[slug]/      # 梗词条 SEO 页
├─ lib/
│  ├─ translator/       # ★ 翻译路由器内核
│  │  ├─ types.ts       # Provider 统一接口 + 系统提示词构造
│  │  ├─ router.ts      # 选路 + 预算降级 + 缓存
│  │  ├─ cache.ts       # 原文 SHA-256 去重 + LRU 缓存
│  │  └─ providers/     # deepseek / glm / google / openai(预留)
│  └─ corpus/           # 数据飞轮：采集 + 纠错 + 采纳
└─ components/          # TranslatorBox 等
```

## 文档

- [技术架构文档](docs/architecture.html) — 架构图 / 数据模型 / 成本测算 / 四周计划
- [开发路线图](docs/roadmap.md) — 里程碑与 KPI

## 关键设计

1. **翻译路由器**是角1/角2 共用内核，Provider 全部实现同一接口，换模型不改业务代码
2. **成本控制**：原文哈希去重 + LRU 缓存 + 预算超限自动降级 GLM 免费档（默认 ¥1000/月）
3. **数据飞轮**：投票/纠错/工作台编辑三路数据入库 → 质量分过滤 → 反哺路由与术语库
4. **盲测匿名**：前端只见 A/B/C，真实模型映射只在服务端解析，保证投票公正

## 部署（FC）

```bash
npm run build           # 生成 .next/standalone
npm run deploy:fc       # 见 scripts/deploy-fc.ps1（需先按 FC 文档配置）
```

阶段一：cn-hongkong（免备案）；备案完成后迁 cn-hangzhou。

