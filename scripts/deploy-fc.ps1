# aifanyi.com 部署脚本（阿里云 FC 3.0 · nextjs 环境）
# 前置：已运行 npm run build（生成 .next/standalone）
# 产物：dist/aifanyi-fc-<时间戳>.zip，需人工在 FC 控制台创建函数（environment=nextjs）并上传到 LATEST
# 说明：本脚本不含任何删除操作；每次打包生成带时间戳的新产物，旧产物保留便于回滚
# 参考 skill：fc-nextjs-website

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zip = Join-Path $dist "aifanyi-fc-$stamp.zip"

if (-not (Test-Path (Join-Path $root '.next\standalone\server.js'))) {
  Write-Host '未找到 .next/standalone/server.js，请先执行 npm run build' -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null

# FC nextjs 环境要求：server.js 位于 zip 根目录
# 使用带时间戳的独立 staging 目录，避免与旧产物冲突
$staging = Join-Path $dist "fc-staging-$stamp"
New-Item -ItemType Directory -Force -Path $staging | Out-Null

# 1. standalone 产物 → zip 根
Copy-Item (Join-Path $root '.next\standalone\*') $staging -Recurse -Force
# 2. 静态资源（.next/static 与 public）
Copy-Item (Join-Path $root '.next\static') (Join-Path $staging '.next\static') -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path (Join-Path $root 'public')) {
  Copy-Item (Join-Path $root 'public') $staging -Recurse -Force
}

# 3. 打包（zip 文件名带时间戳，不覆盖旧包）
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip -CompressionLevel Optimal

Write-Host "打包完成: $zip" -ForegroundColor Green
Write-Host "staging 目录: $staging" -ForegroundColor Yellow
Write-Host '下一步（人工）：FC 控制台创建函数（environment=nextjs，处理函数 node /code/server.js）→ 上传 zip 到 LATEST → 发布'
