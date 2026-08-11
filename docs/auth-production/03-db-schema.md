# 03 · 数据库 Schema（认证相关）

> 表名：Prisma 默认 PascalCase（psql 查询需加引号）。psql 路径 /usr/local/pgsql/bin/psql

## User（统一账户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | cuid PK | |
| email | text UNIQUE | verified 后才可合并账户 |
| emailVerified | timestamptz | OTP 验证通过时写入 |
| nickname / avatar | text | 展示信息 |
| authProvider | text | 兼容旧字段（新逻辑以 AuthIdentity 为准） |
| status | text default active | 账户状态 |
| lastLoginAt / createdAt / updatedAt | timestamptz | |

## AuthIdentity（多身份绑定，Phase 1 新增）

| 字段 | 类型 | 约束 |
|------|------|------|
| id | cuid PK | |
| userId | text FK→User | onDelete: Cascade |
| provider | text | google / email / apple / wechat... |
| providerAccountId | text | Google sub / 邮箱 / Apple sub |
| providerEmail | text? | 冗余存储便于展示 |
| createdAt | timestamptz | |
| 唯一约束 | (provider, providerAccountId) | 防重复绑定 |

## Session（Phase 1 扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | cuid PK | |
| sessionToken | text UNIQUE | JWT(HS256) 三段式 |
| userId | text FK→User | Cascade |
| createdAt / expiresAt | timestamptz | 30 天 |
| lastUsedAt | timestamptz | 设备活跃排序 |
| revokedAt | timestamptz? | **非空=已撤销（Phase 6 修复 validateSession 校验此字段）** |
| ipHash / userAgentHash | text? | 设备审计（哈希存储） |

## VerificationToken（OTP）

| 字段 | 类型 | 说明 |
|------|------|------|
| identifier | text | 邮箱 |
| tokenHash | text | 验证码哈希（不存明文） |
| expiresAt | timestamptz | 10 分钟 |
| used | boolean | |
| attempts | int default 0 | 最多 5 次尝试（Phase 1 新增） |

## PdfJob（资源所有权）

| 字段 | 类型 | 说明 |
|------|------|------|
| taskId | text UNIQUE | 资源标识 |
| userId | text? | 登录用户归属（ownership 检查） |
| guestSessionId | text? | 游客归属 |
| ... | | 其余翻译字段 |

> 关系：User 1:N AuthIdentity/Session/PdfJob/DocumentProgress/Vote 等（Cascade 删除）。
> 删除账户时 PdfJob/UsageLedger/Vote/Correction/Glossary/CreditLedger 手动 deleteMany（无级联），User 级联清理其余。
