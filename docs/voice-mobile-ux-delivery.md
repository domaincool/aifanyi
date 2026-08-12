# /voice Mobile-First UX 重构 — 交付文档

> 提交：e6ded45（核心重构）+ e3ebbbf（SSR 视图判定）+ 881f60f（旧组件清理）
> 上线时间：2026-08-13 07:30（HTTPS 已部署，https://aifanyi.com/voice）

## 一、产品决策落地对照

| # | 决策 | 落地方式 |
|---|------|----------|
| 1 | SSE 真实处理状态 | `/api/voice/translate?stream=1` 推送 `{type:'status',state}`（TRANSCRIBING→TRANSLATING→SYNTHESIZING）→ `{type:'result',ok,usedCredits,...}`；hook 状态机 IDLE→RECORDING→TRANSCRIBING→TRANSLATING→SYNTHESIZING→PLAYING→COMPLETED/ERROR |
| 2 | 移动端气泡 A/B 两侧 | 气泡按 side 左/右对齐（A 左蓝 / B 右绿），标签「A · 中文 → English · 时间」；非纯顺序列表 |
| 3 | 桌面保持双面板 | ≥1024px → VoiceDesktopView（A/B 双面板 + 共享对话记录），与 Mobile 不同 UI |
| 4 | VAD 小齿轮在方向条下方 | 方向条右侧 ⚙️ 下拉：标准 / 安静环境 / 嘈杂环境（映射 1200/2000/600ms 静音阈值），用户看不到「VAD 灵敏度」字样 |
| 5 | 预计额度常显 | 录音按钮上方常显「预计使用约 X 个额度 / 次」（服务端 `/api/credit/estimate?feature=voice&seconds=15` 算价）；完成后气泡/对话流显示「本次使用 X 个额度」（usedCredits 三段实际之和，降级段不计） |
| 6 | 默认自动断句 | 默认点按开始 → 静音持续阈值自动断句翻译；「按住说话」为 checkbox 备用模式；无无限持续监听 |
| 7（最重要） | 手机放中间开箱即用 | 手机横屏自动进入**面对面模式**（左右分屏，右半 rotate180°，A/B 各自面对自己的控制区，各自大按钮+波形+最近结果+重试，中间窄对话流）；竖屏单手模式 + 提示「手机放两人中间，可横屏进入面对面模式」 |

## 二、三视图路由

| 视口 | 视图 | 布局 |
|------|------|------|
| ≥1024px（桌面/平板横屏） | VoiceDesktopView | 双面板 A/B + 对话记录 |
| <1024px 且横屏（手机横放） | VoiceFaceView | 左右分屏面对面（B 区 180° 旋转） |
| <1024px 且竖屏（手机竖持） | VoiceMobileView | 方向条 + 对话流 + 底部固定大录音按钮 |

SSR 阶段用 UA 判定初始视图（桌面 UA→双面板、移动 UA→单手），消除 hydration 首帧布局跳动；横竖屏旋转由客户端 matchMedia 修正。

## 三、新增/修改文件

| 文件 | 说明 |
|------|------|
| `src/lib/voice/useVoiceSession.ts` | 核心状态机 hook（UI 无关）：录音采集/WAV 16kHz 编码/VAD 三种灵敏度/30s 上限/波形（rms 80ms 节流）/SSE 消费/播放控制/预计+本次额度/最近语言/清空/后台取消 |
| `src/components/voice/VoiceRouter.tsx` | 断点路由（desktop/face/mobile + ssrMobile prop） |
| `src/components/voice/VoiceMobileView.tsx` | 竖屏单手视图（底部 84px 大按钮 + safe-area） |
| `src/components/voice/VoiceFaceView.tsx` | 横屏面对面视图（B 区 rotate180） |
| `src/components/voice/VoiceDesktopView.tsx` | 桌面双面板视图 |
| `src/components/voice/MsgBubble.tsx` | 共享气泡（原文/译文/播放/暂停/重播/复制/自动播放被拦提示/TTS 失败提示/额度） |
| `src/app/voice/page.tsx` | metadata + force-dynamic + SSR CSS 极简头部保底 + UA 判定传参 |
| `src/app/api/voice/translate/route.ts` | **Step1 已改**：runPipeline 抽取 + `?stream=1` SSE + usedCredits |
| `src/app/api/credit/estimate/route.ts` | **Step1 已改**：`feature=voice&seconds=N` 三段组合算价 |

已删除：`VoicePageClient.tsx`、`VoiceInputButton.tsx`、`VoiceTranslateButton.tsx`（被新架构取代，无引用）。

## 四、状态机与异常

状态：`IDLE → RECORDING（波形+计时）→ TRANSCRIBING → TRANSLATING → SYNTHESIZING → PLAYING → COMPLETED / ERROR`

异常处理（全中文可读）：
- 未登录（401）→「请先登录后再使用」+ 弹登录框
- 额度不足（402）→「额度不足，请先补充额度」
- 限流（429）→「操作太频繁，请稍等片刻再试」
- 权限拒绝 →「麦克风权限被拒绝。请在浏览器设置中允许，iOS 请在 设置→Safari→麦克风 中开启」
- 无设备 / 录音初始化失败 / 静音（<0.1s 样本）→「没有听到声音，请再说一次」/ 30s 上限提示 / 网络异常
- TTS 失败 → 降级返回文字 +「语音生成失败，可复制译文使用」（不整体失败，不扣 TTS 额度）
- 自动播放被拦 → 气泡内「🔇 浏览器禁止自动播放，点击上方播放」fallback
- 切后台/来电/锁屏 → 自动取消录音

## 五、验证情况

| 项 | 结果 |
|----|------|
| tsc + next build | ✅ 通过 |
| SSE E2E（服务器） | ✅ 200 text/event-stream，4 事件顺序正确（TRANSCRIBING→TRANSLATING→SYNTHESIZING→result ok:true usedCredits:3） |
| 桌面 SSR（UA=桌面） | ✅ HTML 含「对话记录」（DesktopView） |
| 移动 SSR（UA=iPhone） | ✅ HTML 含「点按下方按钮开始说话…」+ 齿轮 + 底部大按钮（MobileView） |
| 桌面浏览器实测（1280×720） | ✅ A 说话（中文→English）/ B 说话（English→中文）双面板 + 语言下拉 + 录音大按钮「点按开始（说完自动翻译）」+ 对话记录空态 + 顶部极简无导航 + 页脚保留 |
| 移动/横屏真机 | ⏳ 待用户手机实测（竖屏单手 + 横屏面对面） |

## 六、已知限制与后续

- 横屏 FaceView 双端共用**同一份方向**（A:zh→en / B:en→zh 联动交换），各自独立录音会话与限流窗口
- 移动端录音需 HTTPS + 麦克风权限；iOS Safari 首次需用户手势启动 AudioContext（点按按钮即满足）
- 波形为音量条（rms 驱动），非原始频谱
- 后续可做：多设备场景（两台手机同房间各持一端）、TTS 语速/音色选择、面对面模式自动检测屏幕方向进入

## 七、交付清单（人工验收）

1. 手机竖屏打开 https://aifanyi.com/voice → 底部大按钮，点按说话自动翻译，气泡左右分侧
2. 手机横屏 → 自动切换左右分屏，A/B 各持一端互相说话
3. 齿轮切换 标准/安静/嘈杂 后，静音断句时长变化（安静=更久才断，嘈杂=更快断）
4. 录音按钮上方显示「预计使用约 X 个额度 / 次」；完成一句后显示「本次使用 X 个额度」
5. 桌面 ≥1024px → 双面板 + 对话记录
