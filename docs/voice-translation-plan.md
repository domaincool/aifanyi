# Voice Translation System — 实操开发方案（评估报告 v1）

> 日期：2026-08-12 · 状态：待用户批准 · 目标：aifanyi.com 统一语音能力（Speech In → STT → Translation → TTS → Audio Out）

---

## 0. 结论先行

**✅ 能做，且与现有系统零冲突**——因为方案设计（复用 Translation Engine / Credit Engine / Usage / History）与现有架构天然契合：
- 翻译引擎 `TranslatorRouter`（DeepSeek 主 + GLM 降级 + 缓存）**原样复用**，语音翻译 = STT 得到文本 → 调现有 `/api/translate` 同一逻辑 → TTS 播报译文
- Credit Engine（`beginSync/endSyncSuccess/endSyncFail` + PricingRule 表驱动）**原样复用**，只需新增 2 个 feature（`speech_to_text` / `text_to_speech`）定价规则 + 1 个语音任务记录表
- 认证/游客策略/对账扫描器/Admin 面板**全部不动**

**技术选型**：智谱开放平台（已有 GLM key，需验证同 key 可调语音 API）：
| 能力 | 模型 | 规格 | 价格 |
|---|---|---|---|
| STT | GLM-ASR-2512 | wav/mp3 ≤25MB ≤30s | 0.06 元/分钟 |
| TTS | GLM-TTS | 中英及多语 | ~0.04 元档（需实测确认） |
| 实时对话（未来） | GLM-4-Voice / GLM-Realtime | 端到端语音 | 预留架构位 |

**关键决策点（需用户确认）**：① 智谱 key 能否直接调语音 API（大概率能，同一开放平台）；② TTS 价格实测后定 credit 定价；③ 免费/登录用户音频时长上限（建议 15s/句 免费档、30s 登录档）。

---

## 1. 与现有功能冲突分析

| 现有模块 | 是否触碰 | 说明 |
|---|---|---|
| Translation Engine（router/providers/cache） | **零修改** | 语音翻译只做「STT 产出文本 → 调 translate() 逻辑」；不新增翻译 provider |
| Credit Engine（engine/pricing/policy） | 扩展非修改 | 新增 feature 常量 + seed 定价；reserve/consume 机制复用 |
| UsageRecord / History | 扩展 | 复用 UsageRecord（durationSeconds/inputCharacters 字段已有），语音任务加 `VoiceJob` 表存音频元数据（不存音频本体） |
| 认证（session/guest） | 零修改 | 复用 getAuthUserId；游客策略：语音属高成本 → **登录必填**（同 PDF/图片） |
| 首页 TranslatorBox / 文件工具 | 增量修改 | 文本输入框加麦克风按钮 + 语音结果卡；不动文本翻译逻辑 |
| /api/translate | 零修改 | 语音翻译走新 `/api/voice/translate`，内部复用 provider 直接调（绕 router 缓存可留可去） |
| 对账扫描器 / Admin / 删户 | 零修改 | 新增 feature 自动纳入对账（Ledger 不变量不变） |
| 定价（PricingRule seed） | 新增 2 条 | `speech_to_text`（/分钟）、`text_to_speech`（/千字符），版本化，调价秒级生效 |

**无冲突结论**：语音是「新的输入/输出模态」，翻译核心、额度核心、账户体系全部复用，唯一新增的是「音频采集与 ASR/TTS 供应商适配层」+「语音 UI」。

---

## 2. 架构设计

```
浏览器（Mobile First）
  ├─ MediaRecorder 录音（webm/opus）→ 前端转 wav（16kHz mono，ASR 要求）
  ├─ 麦克风权限/状态机：Idle→Recording→Processing→Success/Error
  ├─ VAD（Web Audio AnalyserNode，静音 500-1500ms 自动断句，可配置）
  └─ 音频播放（TTS 返回 mp3/wav URL 或 base64 → Audio 播放，处理 Autoplay Policy）

API（全部登录必填，服务端算价）
  POST /api/voice/transcribe    录音上传 → STT → 返回识别文本
  POST /api/voice/translate     识别文本 → 翻译（复用引擎）→ TTS → 返回 {text, translation, audio}
  GET  /api/voice/settings      前端拉取限制（maxDuration/autoplay 默认/定价展示用）

服务端
  src/lib/voice/{asr,tts,limits,settle}.ts
    ├─ asr.ts     智谱 GLM-ASR 适配（multipart 上传，wav/mp3 校验，≤25MB/≤30s）
    ├─ tts.ts     智谱 GLM-TTS 适配（文本→音频，缓存文本哈希 → 重复朗读零成本）
    ├─ limits.ts  时长/大小/频率限制（服务端权威，前端只展示）
    └─ settle.ts  reserve(estimated) → ASR+翻译+TTS → consume(actual) / fail→release

表（prisma 新增）
  VoiceJob  id/taskId唯一/userId/sourceLang/targetLang/audioDurationSec/audioSize/transcript/translation/audioUrl?(短期)/status/creditState/reservedCredits/consumedCredits/createdAt/expiresAt
    - 原始音频默认 24h 后删（音频生命周期：尽快删除，不默认永久保存）
  UsageRecord 复用（feature='voice_translate' 或分别记 stt/tts 明细；durationSeconds/inputCharacters 已有字段）

定价建议（PricingRule seed 新增 2 条 + voice_translate 组合）
  speech_to_text   1 credit / 15 秒（0.06元/分 ≈ 0.0015元/15s，1 credit 定价已宽松）
  text_to_speech   1 credit / 200 字符（TTS 便宜，按千字符计）
  voice_translate  组合 = STT + 翻译(2/千字) + TTS；单次上限（防恶意）：≤30s、≤25MB
  前端显示「预计使用约 XX 额度」，不显示 token/秒
```

---

## 3. 分阶段实操计划（每阶段可独立上线）

### 阶段 V1 — 语音输入 + 文本朗读（核心，1 次交付）
- [ ] `.env` 新增 `GLM_ASR_MODEL=glm-asr-2512` / `GLM_TTS_MODEL=glm-tts`（验证现有 GLM key 可用）
- [ ] `src/lib/voice/asr.ts` + `src/lib/voice/tts.ts`（智谱适配，60s 超时 + 降级 + 缓存 TTS）
- [ ] `src/lib/voice/limits.ts`（服务端权威限制：30s/25MB/登录必填/每分钟 5 次）
- [ ] `POST /api/voice/transcribe`（录音→文本，settle 结算 STT）
- [ ] `POST /api/voice/tts`（文本→音频，settle 结算 TTS，供「朗读译文」按钮用）
- [ ] 首页 TranslatorBox：麦克风按钮（状态机 + 权限拒绝/取消/无声音提示）+ 识别文本可编辑/重录/翻译 + 译文「播放/暂停/重播」+ Autoplay Policy 处理（被禁→提示「点击播放译文」）
- [ ] PricingRule seed：speech_to_text / text_to_speech + 单测

### 阶段 V2 — 语音翻译 + 自动播放（组合链路）
- [ ] `POST /api/voice/translate`：STT→翻译→TTS 一次调用（组合结算，翻译复用引擎）
- [ ] 「自动播放译文」设置（localStorage + 默认关，符合浏览器策略；被禁时降级为提示点击）
- [ ] 失败分级：STT 失败「没有听清，请再说一次」/ 翻译失败「翻译失败，请重试」/ **TTS 失败仍显示文字结果，不整体失败**
- [ ] 音频生命周期：VoiceJob 原始音频 24h 自动清理（复用扫描器），UI 不展示 audio id

### 阶段 V3 — 双向语音翻译 + 面对面模式（移动端重点）
- [ ] `/voice` 页面：上半 A 语言 / 下半 B 语言，🎙️ 按住说话 + 自动断句（VAD 500-1500ms 可配置）
- [ ] 每句生成 Conversation Message（气泡流：A 说的原文+译文 / B 说的原文+译文，可播放）
- [ ] 移动端处理：麦克风权限拒绝/取消、后台切换（页面可见性暂停）、网络中断重试、耳机/扬声器
- [ ] 历史进入「我的翻译」（默认展示：原文/译文/时间/额度，不展示 Audio ID）

### 阶段 V4 — 加固 + 验收（对应方案十六清单）
- [ ] 15 项验收用例：正常/拒麦/取消/无声音/网络中断/STT失败/翻译失败/TTS失败/自动播放失败/录音超时/超额度/并发/重复请求/移动端 Safari/Android Chrome
- [ ] Rate Limit（IP+用户 双重）、Audio 校验（MIME/大小/时长）、并发与幂等（idempotencyKey）
- [ ] 对账扫描器覆盖 VoiceJob（超时结算、过期清理）
- [ ] 交付文档 + 上线公告

---

## 4. 成本与定价（估算）

| 能力 | 供应商单价 | credit 定价 | 单次典型成本 |
|---|---|---|---|
| STT | 0.06 元/分钟 | 1 credit/15s | 10s 语音 ≈ 0.01 元 ≈ 1 credit |
| 翻译 | 已有（DeepSeek） | 2/千字 | 一句 ≈ 0-1 credit |
| TTS | ~0.04 元档 | 1 credit/200 字符 | 一句 ≈ 0.005 元 ≈ 1 credit |
| **语音翻译一次** | ~0.02 元 | **≈ 2-3 credit** | 登录送 300 ≈ 100+ 次 |

免费档 vs 登录档：游客**不可用**语音（高成本）；登录用户 30s/句、15 句/分钟；未来 Pro 用户可放宽（架构已留 `limits.ts` 分级）。

---

## 5. 风险与需用户确认项

1. **⚠️ 智谱 key 权限**：现有 GLM_API_KEY 大概率可调 ASR/TTS（同一 bigmodel 开放平台），但需实测确认；若不行需用户开新 key（免费额度通常够）
2. **TTS 音质/延迟**：GLM-TTS 需实测中文/英文听感；不满意可降级方案（如 edge-tts 免费，非官方，慎用）
3. **移动端录音格式**：Safari 输出 mp4（AAC）非 webm——ASR 只收 wav/mp3，**前端需转码**（ffmpeg.wasm 或 Web Audio 重采样），这是最大技术风险点，V1 先做桌面 Chrome + 移动端 Chrome，Safari 转码放 V3
4. **30s 限制**：ASR 限 30s/段——智能断句（VAD）保证每句 <30s，符合「一句一译」产品形态；超长按住说话会被 VAD 自动断句
5. **音频隐私**：默认 24h 删除原始音频（扫描器清理），符合方案八；需在隐私政策补充「语音数据短期处理」条款（可复用现有 privacy 页）
6. **费用风险**：语音为高成本能力，Rate Limit + 上限 + 登录必填三重防护；月度预算可加 `VOICE_MONTHLY_BUDGET_CNY` 熔断（复用 MODEL_BUDGET 模式）

---

## 6. 明确不做（防过度开发）

- 不做实时流式对话（GLM-4-Voice 只留架构位，V4 后评估）
- 不做发音练习/语言学习（未来扩展，当前不建）
- 不保存用户音频库（默认即删）
- 不做独立语音账户/额度（严格复用 Credit Engine）

---

## 7. 一句话总结

> 方案可行、零冲突：语音 = 新增「输入/输出模态」+「ASR/TTS 适配层」+「2 条定价」，翻译与额度核心完全复用；分 V1-V4 四阶段约 3-4 轮交付，最大风险是移动端 Safari 录音转码，已规划降级路径。

**批准后第一步**：验证智谱 key 调 ASR/TTS（写 10 行测试脚本），通过即开工 V1。
