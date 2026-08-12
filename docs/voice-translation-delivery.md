# 语音翻译系统交付文档（V1–V4）

> 版本：2026-08-13（V4 收官）｜ 涉及提交：54e33ae → 57002ed
> 在线入口：https://aifanyi.com/voice （面对面语音翻译）/ 首页翻译框 🎤🎙️

## 一、能力总览

| 阶段 | 能力 | 入口 | 状态 |
|---|---|---|---|
| V1 | 语音输入（录音→文字）+ 文本朗读（文字→语音） | 首页翻译框 🎤 / 翻译结果 🔊 | ✅ 上线 |
| V2 | 一键语音翻译（录音→STT→翻译→TTS，三段独立结算） | 首页翻译框 🎙️ | ✅ 上线 |
| V3 | 面对面语音翻译（双面板 + 对话流 + VAD 自动断句） | /voice 页面 | ✅ 上线 |
| V4 | 15 项验收 + 加固 + 本交付文档 | — | ✅ 完成 |

## 二、API 清单

| 接口 | 方法 | 鉴权 | 说明 | 结算 |
|---|---|---|---|---|
| `/api/voice/transcribe` | POST | 登录 | 录音→文字（multipart: file/mime/duration/sourceLang） | speech_to_text 1 credit/分钟 |
| `/api/voice/tts` | POST | 登录 | 文本→wav（JSON: text/voice；≤500 字符/次） | text_to_speech 1 credit/千字符 |
| `/api/voice/translate` | POST | 登录 | 组合：STT→翻译→TTS（multipart 同 transcribe + targetLang/scenario） | 三段独立结算，TTS 失败降级不退整单 |

响应约定：`{ok:true, text, translation, model, cached, audioBase64, ttsFailed}` / 错误 `{ok:false, error}`。
状态码：401 未登录（前端弹登录）、400 参数（空音频/超长/格式）、402 余额不足、429 限流（5 次/分钟/用户）、502 上游失败、500 兜底。

## 三、额度与结算（复用 Credit System）

- 登录必填（语音为高成本功能，同 PDF 策略）；定价已入 PricingRule 与盲测页面展示
- 组合接口三段独立 beginSync/endSync：任一段失败只退该段（opened 栈回退）；翻译命中缓存 actual=0
- TTS 失败 → 返回文字译文 + `ttsFailed:true`，**不**整体失败
- 对账不变量 available+reserved == ΣLedger.amount 持续成立（E2E ⑨ 实测 available=593 与消耗一致）

## 四、验收测试报告（V4，服务器实测）

### API 自动化 12 项（全部通过 ✅）

| # | 用例 | 结果 |
|---|---|---|
| ① | 未登录 401 | ✅ status=401 |
| ② | 空音频 400（路由层拦截，不调 ASR） | ✅ 400「录音太短或没有声音」 |
| ③ | 静音样本合理处理 | ✅ 502「没有听清，请再说一次」（不 500 不扣费） |
| ④ | 正常语音翻译三段结算 | ✅ 3.7s，译文正确，audio 519KB |
| ⑤ | 重复提交两次 | ✅ 200/200 |
| ⑥ | 并发两请求 | ✅ 无 500；同窗口第 5/6 次被 429 限流拦截（防护正确） |
| ⑦ | 超长文本 TTS（600 字符） | ✅ 400「文本过长（限 500 字符）」 |
| ⑧ | 余额不足（1 credit 用户） | ✅ 402「本次预计消耗约 1 额度，当前剩余 0」单测 3 连 0.8s/0.0s/0.0s |
| ⑨ | 额度查询 | ✅ available 字段正常 |
| ⑩ | 删户软删 | ✅ 200「账户已删除，历史记录按隐私策略匿名保留」 |
| ⑪ | 删户后会话失效 | ✅ 401（validateSession status 检查） |
| ⑫ | 重复删户 | ✅ 200（不 500，本次加固） |

### 前端交互人工验收清单（需真实设备，建议按此逐项过）

| # | 场景 | 预期 |
|---|---|---|
| 1 | 正常录音→松手/自动断句→翻译→播放 | 气泡入列、🔊 可播、自动播放开关生效 |
| 2 | 拒绝麦克风权限 | 中文提示「麦克风权限被拒绝」 |
| 3 | 录音中取消 | 停止且不产生记录/扣费 |
| 4 | 无声音（<0.1s 采样） | 「没有听到声音，请再说一次」 |
| 5 | 浏览器禁止自动播放 | 保留播放按钮 + 提示 |
| 6 | 按住超 30s | 自动断句翻译 |
| 7 | 切后台/锁屏 | 自动取消录音 |
| 8 | 移动端 Safari / Android Chrome 按住说话 | 正常录音翻译（pointer 事件已双保险） |
| 9 | 网络中断时提交 | 「网络异常，语音翻译失败，请重试」 |

## 五、V4 期间发现并修复的 bug

| bug | 根因 | 修复（提交） |
|---|---|---|
| 空音频 502 | 空文件直接进 ASR，智谱 502 | 路由层 `buf.length < 1024 → 400`（f7d3555） |
| 重复删户 500 | 匿名化邮箱 `deleted_{id前8位}@deleted.local` 撞 Unique 约束（id 前缀相同的用户先后删除） | 加时间戳后缀保证唯一（57002ed） |
| 按住说话松手不停止 | pointerdown 后按钮卸载 + 权限框导致 pointerup 丢失 | setPointerCapture + 录音中按钮不卸载 + document 级 pointerup/touchend 兜底（895f16c、8f1fdae） |

## 六、已知限制（不承诺口径）

- **ASR 上游偶发慢**：智谱 ASR 偶发 60s+ 超时（含重试最长 ~121s），此时请求可能被平台 maxDuration=120s 截断返回 500/超时；属上游波动，已做 1 次重试 + 退避，前端提示重试
- **静音/极小声**：可能返回「没有听清」（502 文案），不扣费（endSyncFail 退回）
- **Safari 录音**：依赖 Web Audio ScriptProcessor（已弃用 API），iOS 13+ 实测可用；极端旧机型可能无输入
- **TTS 音色**：默认 tongtong；nanke 音色已下线（智谱 1214）
- **额度**：语音按量计费（STT/TTS 各 1 credit 档），登录必填；低余额 402 会提示补充
- **限流**：每用户 5 次/分钟（语音接口），防误触/刷单

## 七、部署说明

```
git push origin main
ssh root@47.74.23.240  # deploy.sh 或手动：
cd /opt/aifanyi && git pull && rm -rf .next && npm run build
pm2 delete aifanyi; fuser -k 3000/tcp; pm2 start npm --name aifanyi -- start
# 验证：curl https://aifanyi.com/voice → 200；git log HEAD 确认 commit
```

- 依赖环境变量：`GLM_VOICE_API_KEY`（智谱语音专用，与翻译 GLM_API_KEY 隔离）
- 服务器 E2E 脚本：`scripts-voice-e2e/`（setup.ts 造用户 + run.cjs 12 项验收，本地不入 git）
