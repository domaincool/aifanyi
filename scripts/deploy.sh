#!/bin/bash
# aifanyi 一键部署：git pull + build + 重启 + 验证
# 用法：本地 git push 后，在服务器执行 bash scripts/deploy.sh
set -e
cd /opt/aifanyi
export PATH=/usr/local/bin:$PATH
export NODE_OPTIONS="--max-old-space-size=1536"

echo "=== 1. 拉取最新代码 ==="
git pull origin main

echo "=== 2. 构建 ==="
npm run build 2>&1 | tail -3

echo "=== 3. 重启应用（干净模式，避免端口占用） ==="
pm2 delete aifanyi 2>/dev/null || true
PIDS=$(ss -tlnp | grep ':3000' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
for p in $PIDS; do kill -9 $p 2>/dev/null || true; done
sleep 1
pm2 start npm --name aifanyi -- start --time 2>&1 | grep -E 'online|errored' | head -1
sleep 4

echo "=== 4. 验证 ==="
curl -s -o /dev/null -w "首页: HTTP %{http_code}\n" https://aifanyi.com/
curl -s -o /dev/null -w "sitemap: HTTP %{http_code}\n" https://aifanyi.com/sitemap.xml
echo "部署完成 ✅"
