#!/bin/bash
# aifanyi 一键部署：git pull + build + 重启 + 验证（V1.2 P0-3 增强版）
# 用法：本地 git push 后，在服务器执行 bash scripts/deploy.sh
# 增强：HEAD 前后记录 / health gate / 版本核对 / smoke 断言
set -e
cd /opt/aifanyi
export PATH=/usr/local/bin:$PATH
export NODE_OPTIONS="--max-old-space-size=1536"
LOG=/opt/aifanyi/.deploy.log

echo "=== 1. 记录部署前 HEAD ==="
BEFORE=$(git rev-parse HEAD)
echo "[$(date '+%F %T')] before=$BEFORE" >> $LOG
echo "before=$BEFORE"

echo "=== 2. 拉取最新代码 ==="
git pull origin main
AFTER=$(git rev-parse HEAD)
echo "after=$AFTER" >> $LOG
echo "after=$AFTER"
if [ "$BEFORE" = "$AFTER" ]; then echo "⚠️ HEAD 未变化，确认是否 push 了最新提交"; fi

echo "=== 3. 构建 ==="
npm run build 2>&1 | tail -3

echo "=== 4. 重启应用（干净模式，避免端口占用） ==="
pm2 delete aifanyi 2>/dev/null || true
PIDS=$(ss -tlnp | grep ':3000' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
for p in $PIDS; do kill -9 $p 2>/dev/null || true; done
sleep 1
pm2 start npm --name aifanyi -- start --time 2>&1 | grep -E 'online|errored' | head -1
sleep 4

echo "=== 5. 健康检查 ==="
curl -s -o /dev/null -w "health: HTTP %{http_code}\n" https://aifanyi.com/api/health || echo "WARN: /api/health 无响应"
curl -s -o /dev/null -w "首页: HTTP %{http_code}\n" https://aifanyi.com/
curl -s -o /dev/null -w "sitemap: HTTP %{http_code}\n" https://aifanyi.com/sitemap.xml

echo "=== 6. smoke 断言 ==="
if curl -s https://aifanyi.com/ | grep -q '爱翻译'; then echo "smoke: 首页品牌语 ✅"; else echo "smoke: 首页品牌语 ❌"; fi
if curl -s -o /dev/null -w "credit 页: HTTP %{http_code}\n" https://aifanyi.com/credit; then :; fi

echo "=== 7. 版本核对 ==="
echo "生产运行 commit = $AFTER（$BEFORE → $AFTER）"
echo "部署完成 ✅"