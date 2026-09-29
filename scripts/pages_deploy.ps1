# NOTE: this file MUST keep a UTF-8 BOM. Windows PowerShell 5.1 reads
#       BOM-less .ps1 as GBK, which turns the Chinese comments below into
#       parser errors. If you edit it with a tool that drops the BOM, re-add it:
#         $c = Get-Content $p -Raw -Encoding UTF8; Set-Content $p $c -Encoding UTF8
# ============================================================
# 把静态站部署到 Cloudflare Pages（备用入口）
# ------------------------------------------------------------
# 为什么需要：实测确认封锁匹配的是 `ccwu.cc` 这个**字符串** ——
# 换 IP 无效、换 zone 也无效。所以 zhaokening.ccwu.cc 一被锁，
# 整站（含音乐页、影视页）就直接打不开。Pages 的 <proj>.pages.dev
# 是**不同 apex**，实测可达。
#
# ⚠️ 只复制**运行时要用的**文件，绝不整仓库推 —— 仓库里有 .git（完整
#    历史）、cloudflare/（worker 源码）、scripts/、tools/ 等，都不该
#    进静态托管。
#
# 用法：
#   $env:CLOUDFLARE_API_TOKEN = '<操作令牌>'
#   $env:CLOUDFLARE_ACCOUNT_ID = 'dd634204b125f1fb16109afcc96864bf'
#   pwsh scripts/pages_deploy.ps1
# ============================================================
$ErrorActionPreference = 'Stop'

$RepoRoot  = Split-Path -Parent $PSScriptRoot
$Project   = if ($env:PAGES_PROJECT) { $env:PAGES_PROJECT } else { 'sakura-blog' }
$Stage     = Join-Path $env:TEMP 'sakura-blog-stage'

# 目录白名单（运行时要用的）
$Dirs = @('css', 'js', 'img', 'icons', 'webfonts', 'games', 'data')
# 根目录下的散文件白名单
$Files = @(
  '404.html', 'Archives.html', 'Games.html', 'home.html', 'index.html',
  'Journal.html', 'music.html', 'Tools.html', 'TV.html',
  'manifest.json', 'robots.txt', 'sitemap.xml', 'sw.js',
  'favicon.ico', 'og-image.png'
)

Write-Host "仓库: $RepoRoot"
Write-Host "项目: $Project"
Write-Host "暂存: $Stage"

if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

$n = 0
foreach ($d in $Dirs) {
  $src = Join-Path $RepoRoot $d
  if (-not (Test-Path $src)) { Write-Host "  跳过（不存在）: $d"; continue }
  Copy-Item $src (Join-Path $Stage $d) -Recurse -Force
  $n += (Get-ChildItem (Join-Path $Stage $d) -Recurse -File | Measure-Object).Count
}
foreach ($f in $Files) {
  $src = Join-Path $RepoRoot $f
  if (-not (Test-Path $src)) { Write-Host "  跳过（不存在）: $f"; continue }
  Copy-Item $src (Join-Path $Stage $f) -Force
  $n++
}

# Cloudflare Pages 的原生 SPA/路由靠 _redirects / _headers，这里不用；
# 但 404.html 需要让 Pages 认出来，Pages 默认就会用根目录的 404.html。

$size = (Get-ChildItem $Stage -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("暂存完成: {0} 个文件, {1:N1} MB" -f $n, ($size / 1MB))

# 安全检查：绝不允许把这些推上去
foreach ($bad in @('.git', '.github', 'cloudflare', 'scripts', 'tools', '.idea', 'server.js', 'README.md')) {
  if (Test-Path (Join-Path $Stage $bad)) { throw "暂存目录里出现了不该有的 $bad —— 中止" }
}

if (-not $env:CLOUDFLARE_API_TOKEN) { throw '缺少 CLOUDFLARE_API_TOKEN' }
if (-not $env:CLOUDFLARE_ACCOUNT_ID) { throw '缺少 CLOUDFLARE_ACCOUNT_ID' }

Write-Host "开始部署…"
# PowerShell 禁用了脚本执行 -> 用 wrangler.cmd
& wrangler.cmd pages deploy $Stage --project-name=$Project --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw "部署失败（exit $LASTEXITCODE）" }

# ⚠️ 真实子域**不一定**等于项目名 —— 全局重名时 Cloudflare 会加后缀
#    （本项目实测 sakura-blog -> sakura-blog-8dv.pages.dev）。
#    所以别在这里拼字符串，去 API 问。
try {
  $h = @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN" }
  $r = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$env:CLOUDFLARE_ACCOUNT_ID/pages/projects" -Headers $h -TimeoutSec 40
  $sub = ($r.result | Where-Object { $_.name -eq $Project }).subdomain
  Write-Host "线上地址: https://$sub"
} catch {
  Write-Host "（拿子域失败，去 Dashboard 看）"
}
