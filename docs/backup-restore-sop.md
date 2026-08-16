# aifanyi 数据库备份恢复 SOP（V1.2 P0-1）

> 建立：2026-08-16 · 服务器 root@47.74.23.240 · 已完成一次真实恢复演练（5 表计数全对）

## 一、备份

- 自动备份：crontab `30 3 * * * cd /opt/aifanyi && bash scripts/backup-db.sh >> /opt/backup/aifanyi-backup.log 2>&1`
- 产物：`/opt/backup/aifanyi/aifanyi-YYYYMMDD-HHMMSS.dump`（pg_dump 自定义格式 -Fc）
- 保留周期：7 天滚动（`find -mtime +7 -delete`）
- 手动备份：`bash /opt/aifanyi/scripts/backup-db.sh --manual`
- 验证备份可读：`pg_restore -l /opt/backup/aifanyi/latest.dump | head -5`

## 二、恢复演练（已在临时库执行验证：2026-08-16 ✅）

```bash
export PATH=/usr/local/pgsql/bin:/usr/local/bin:$PATH
DROP_DB="aifanyi_restore_test_$(date +%s)"
# postgres 超级用户建库并授权
su - postgres -c "export PATH=/usr/local/pgsql/bin:\$PATH; psql -c 'CREATE DATABASE $DROP_DB OWNER aifanyi;'"
# 恢复（postgres 用户，--no-owner 避免 owner 冲突）
pg_restore -h 127.0.0.1 -U postgres -d $DROP_DB --no-owner --no-privileges /opt/backup/aifanyi/latest.dump
# 授权后由 aifanyi 直连冒烟（表名 PascalCase 需双引号）
su - postgres -c "export PATH=/usr/local/pgsql/bin:\$PATH; psql -d $DROP_DB -c 'GRANT ALL ON ALL TABLES IN SCHEMA public TO aifanyi;'"
psql -h 127.0.0.1 -U aifanyi -d $DROP_DB -c 'SELECT code, "priceCents", "totalCredits", "purchasedCredits", "bonusCredits" FROM "PricePlan" ORDER BY "sortOrder";'
# 演练后删除临时库
su - postgres -c "export PATH=/usr/local/pgsql/bin:\$PATH; psql -c 'DROP DATABASE IF EXISTS $DROP_DB;'"
```

计数比对基准（2026-08-16）：MemeEntry=347 / User=23 / CreditLedger=238 / PricePlan=3 / CreditAccount=12
恢复演练在临时库执行，**禁止在生产实例上演练**。

## 三、生产故障恢复流程（RPO≤24h / RTO≤2h 目标）

1. 停止应用：`pm2 stop aifanyi`（避免写库）
2. 选恢复点：最近一次成功备份 `/opt/backup/aifanyi/latest.dump`
3. 恢复：`pg_restore -h 127.0.0.1 -U postgres -d aifanyi --clean --if-exists --no-owner --no-privileges /opt/backup/aifanyi/latest.dump`
4. 验证计数（见上）+ 应用冒烟：`curl -s https://aifanyi.com/api/health`
5. 启动应用：`pm2 start aifanyi`
6. 全站冒烟：首页 200 / 登录 / 一次真实翻译 / /api/stats 200
7. 记录：恢复时间、数据丢失窗口、根因 → 追加到本 SOP

## 四、验收标准（V1.2）

- ✅ 自动备份 cron 已安装并实跑（2026-08-16 23:13 真实备份 400K）
- ✅ 保留周期 7 天滚动
- ✅ 恢复演练至少一次（临时库比对计数 + 冒烟，5 表全对）
- ✅ 本 SOP 落地
- 证明「能够恢复」而非仅「备份成功」
