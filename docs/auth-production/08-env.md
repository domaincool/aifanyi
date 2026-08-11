# 08 · 环境变量清单

> 存放：本地 G:\autoclaw\aifanyi\.env + 服务器 /opt/aifanyi/.env（均不入 git）

| 变量 | 说明 | 必填 |
|------|------|------|
| DATABASE_URL | PostgreSQL 连接串 | ✅ |
| SESSION_SECRET | **≥32 字符强随机（当前 64B hex）**，代码 fail-fast | ✅ |
| GOOGLE_CLIENT_ID | 生产 client（见 05 文档） | ✅ |
| GOOGLE_CLIENT_SECRET | 生产 client secret | ✅ |
| DEEPSEEK_API_KEY | 主翻译模型 | ✅ |
| GLM_API_KEY | 备选翻译模型 | ✅ |
| GOOGLE_TRANSLATE_API_KEY | Google 翻译 | ✅ |
| MODEL_BUDGET_MONTHLY_CNY | 月度预算 | ✅ |
| NEXT_PUBLIC_SITE_URL | 站点 URL | ✅ |
| SMTP_HOST/PORT/USER/PASS/FROM | 邮件发送（**未配置时 OTP 发送失败且不打印验证码**） | ⏳ 待配 |
| OTP_LOG_CODE | 调试用验证码打印（生产勿设） | ❌ |

## 安全约束

- SESSION_SECRET 缺失或 <32 字符 → 运行时 throw（不允许弱密钥登录）
- 密钥轮换：重新生成后所有旧 session 失效（JWT 验签失败），需用户重新登录
- 服务器 .env 权限 600，root 所有
