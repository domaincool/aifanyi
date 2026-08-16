#!/bin/bash
# aifanyi 数据库自动备份（V1.2 P0-1）
# 每日 03:30 执行：pg_dump 全量 → /opt/backup/aifanyi/ ，保留 7 天滚动
# 用法：bash scripts/backup-db.sh [--manual]
set -e
cd /opt/aifanyi
export PATH=/usr/local/pgsql/bin:/usr/local/bin:$PATH

BACKUP_DIR=/opt/backup/aifanyi
KEEP_DAYS=7
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="${BACKUP_DIR}/aifanyi-${STAMP}.dump"
LOG=/opt/backup/aifanyi-backup.log

mkdir -p "$BACKUP_DIR"

# 从 .env 读取 DB 连接（DATABASE_URL 格式 postgresql://user:pass@host:port/db）
DB_URL=$(sed -n "s/^DATABASE_URL=//p" .env | head -1 | tr -d '"' )
if [ -z "$DB_URL" ]; then DB_URL="postgresql://aifanyi@127.0.0.1:5432/aifanyi"; fi

echo "[$(date '+%F %T')] backup start" >> "$LOG"
if pg_dump -Fc "$DB_URL" -f "$FILE" 2>>"$LOG"; then
  SIZE=$(du -h "$FILE" | cut -f1)
  echo "[$(date '+%F %T')] backup OK: $FILE ($SIZE)" >> "$LOG"
else
  echo "[$(date '+%F %T')] backup FAILED" >> "$LOG"
  exit 1
fi

# 保留周期：删除 N 天前的备份
find "$BACKUP_DIR" -name 'aifanyi-*.dump' -mtime +${KEEP_DAYS} -delete >> "$LOG" 2>&1 || true

# 最新备份软链（恢复演练/人工取用）
ln -sf "$FILE" "$BACKUP_DIR/latest.dump"

echo "[$(date '+%F %T')] cleanup done, keep ${KEEP_DAYS}d" >> "$LOG"
echo "OK: $FILE"
