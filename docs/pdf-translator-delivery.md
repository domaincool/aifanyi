# PDF 翻译功能交付文档

> 版本：P1 完整交付（阶段 1-9）｜提交：7771c82 → 3c500fc（errorType 修复）｜日期：2026-08-10
> 线上地址：https://aifanyi.com/tools/pdf-translator

## 一、功能概览

| 模块 | 说明 |
|---|---|
| 上传解析 | PDF 解析（pdfjs-dist v3），页/块级结构模型：bbox/字号/粗体启发式分类（heading/paragraph/list-item/table/header/footer/image）、页眉页脚坐标+重复检测、双栏检测、语言粗判（中/日/韩/俄/英） |
| 后台翻译 | 同页 3-5 块分组 [SEG n] 合并 → DeepSeek 主（重试1次）→ GLM 降级；60s 超时保护（provider_timeout）+ 429 识别降级；进度回写；缓存（hashText 含 model+promptVersion） |
| 双语阅读器 | 目录/页面导航、双栏/仅原文/仅译文、字号调节、段落 hover 复制、limitation 提示 |
| 段落级对比 | 三模型（DeepSeek 缓存零成本 + GLM/Google 并行）匿名对比，浮层三列 + 采用 + 模型标签；20 段/日额度 |
| 下载 | 译文 DOCX / 双语 DOCX / TXT（前端 docx 库生成，保留标题/段落结构，采用模型替换默认译文） |
| 安全与额度 | 20MB/100页/100万字符 上传即校验；5 文件/日 + 50 页/日（clientKey=IP+UA）；惰性 24h 隐私清理（document 置 Prisma.JsonNull）；PdfEvent 13 事件埋点 |

## 二、API 清单

### POST /api/pdf/translate
上传并启动翻译任务。multipart/form-data：`file`（PDF，≤20MB）、`targetLang`（默认 zh）。

- 200：`{ taskId, pageCount, sourceLang, targetLang }`
- 400/413/415：参数/大小/类型错误（中文提示）
- 422：`{ errorType, message }`——`no_text_layer`（扫描版无可提取文本）、`encrypted`（加密 PDF）、`corrupt`（损坏文件）
- 429：`{ errorType: 'quota_exceeded', message }`（额度用尽）

触发：任务入队（PdfJob status=queued）+ 惰性清理过期任务（24h TTL）。

### GET /api/pdf/tasks/:taskId
轮询任务状态（前端 1.5s）。

- 200：`{ taskId, status: queued|processing|completed|failed, progress, currentPage, translatedBlocks, totalInputTokens, totalOutputTokens, totalCostUsd, apiErrorCount, errorType, errorMessage, durationMs, document? }`（completed 时含双语 document）
- 404：taskId 不存在
- `errorType` 取值：`null`（成功）、`partial_translation_failed`（仅部分可翻译块失败）、`translation_failed`（整体失败）、`quota_exceeded`、`no_text_layer`、`encrypted`、`corrupt`
- 结构性块（header/footer/image）不参与翻译、不计入失败（3c500fc 修复）

### POST /api/pdf/compare
段落级三模型对比。JSON：`{ taskId, blockId, sourceText, translatedText }`。

- 200：`{ results: [{ model, text, latencyMs, cached }] }`（deepseek/glm/google）
- 405：GET 等不支持方法
- 429：20 段/日额度用尽

### POST /api/pdf/track
埋点。JSON：`{ event, taskId?, extra? }`。事件白名单（13）：pdf_upload / parse_success / parse_failed / translation_started / completed / failed / retry_clicked / model_compare_clicked / completed / model_adopted / docx_downloaded / bilingual_docx_downloaded / txt_downloaded。非法事件 400。不记录 PDF 内容。

### GET /api/stats?dim=pdf
PDF 维度统计：任务数/成功率/成本 USD/平均耗时/P50/P95/事件分布。

## 三、部署说明

- 环境：Next.js 15（standalone）+ Node 18+ / PostgreSQL 16（PdfJob/PdfEvent 表，`prisma db push` 自动建）
- 关键配置：
  - `.npmrc`：`omit=optional`（CentOS7 glibc 2.17 下 pdfjs-dist 的 canvas 原生依赖崩溃，必须 omit；代价：esbuild/tsx 平台二进制缺失，**本地跑 tsx/esbuild 类脚本需显式安装平台二进制或改用 tsc 编译**）
  - `next.config.mjs`：`serverExternalPackages: ['pdfjs-dist','canvas']`（worker 打包后相对路径失效，防 fake worker）
- 部署流程（`scripts/deploy.sh`）：git checkout 工作区污染文件 → pull → install → build → 干净重启（pm2 delete + 杀 3000 端口 + 全新 start）
- 额度：全站熔断 + 每 clientKey（IP+UA）5 文件/50 页/日，配置在 `src/lib/pdf/config.ts`
- 隐私：上传后 24h document 自动清空（JsonNull），仅保留统计元数据

## 四、测试报告

### 4.1 功能回归（阶段 1-8）
- 线上实测：1 页 PDF → ~10s 完成 → 3/3 块真实 DeepSeek 译文；5 任务全成功，成本 $0.000756；P50 1721ms / P95 2147ms
- 错误体系：损坏 PDF → corrupt；加密/扫描版 → 对应中文提示；假 taskId → 404
- errorType 修复回归（3c500fc）：含 header 文档 4/4 可翻译块全成功 → errorType=null（此前误报 partial_translation_failed）

### 4.2 50 段盲测（PDF 场景 en→zh，10 类 × 5 段 × 3 模型匿名）
评判：运营独立盲评（A=准确流畅 / B=基本达意有瑕疵 / C=错译或严重问题），150 评级。

**总览**：A 122（81.3%）｜B 23（15.3%）｜C 5（3.3%）

**模型维度**：

| 模型 | A | B | C | A 率 |
|---|---|---|---|---|
| DeepSeek | 49 | 1 | 0 | 98.0% |
| Google | 42 | 7 | 1 | 84.0% |
| GLM | 31 | 15 | 4 | 62.0% |

**分类维度**：passive 最稳（14A/1B）→ finance/tech/long-sentence 次之 → coreference 代词处理最弱（4B）→ list 有漏译风险（2C）

**C 级严重问题（已知风险）**：
1. GLM：1.4 trillion → 「1400亿」（应为 1.4万亿，数量级差 10 倍）——数字数量级错误，**高风险**
2. GLM：licensee → 「许可方」（法律主体颠倒）——**高风险**
3. GLM：列表引导句漏译 ×2（「申请需要以下文件：」「安全注意事项：」）——列表场景结构丢失
4. Google：「支付模块」→「模块支付」语序错误（中英混合场景）

**B 级常见模式（prompt 改进方向）**：代词直译未消解指代；术语非标准（经典位/替代规范/延伸目标）；惯用表达生硬；重复冗余。

**结论**：主路由 DeepSeek + GLM 降级 + Google 对比的架构设计正确；GLM 降级场景需关注数字数量级与法律术语；list 类内容建议在 prompt 中强化「保留引导句/标题」指令。

### 4.3 待补测试
- 加密 PDF / 扫描版 PDF / 多栏复杂版式：需外部样本（运营无现成样本，公开样本补测中）
- 50 段盲测的模型维度解读已由运营补充（如需）

## 五、已知限制（不承诺口径）
- 免费额度（5 文件/日/50 页/日），不承诺「无限免费」
- 扫描版 PDF 无文本层 → no_text_layer，需 OCR（P2）
- 加密 PDF 需用户先解密
- 中英混合/长列表场景偶发结构丢失（见 4.2 C 级）