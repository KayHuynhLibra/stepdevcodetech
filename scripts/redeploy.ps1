<#
.SYNOPSIS
  Redeploy Sofiaore / Tarot -> Railway (https://stepkay.codes)

.EXAMPLE
  .\scripts\redeploy.ps1
  .\scripts\redeploy.ps1 -Action deploy
  npm run redeploy
#>
param(
  [ValidateSet("menu", "help", "check", "deploy", "verify", "full", "status")]
  [string]$Action = "menu"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "railway.toml"))) {
  $Root = (Get-Location).Path
}
Set-Location $Root

$LiveUrl = "https://stepkay.codes"
$HealthUrl = "$LiveUrl/health"

function Write-Title([string]$t) {
  Write-Host ""
  Write-Host "========================================" -ForegroundColor DarkCyan
  Write-Host "  $t" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor DarkCyan
}

function Write-Help {
  Write-Title "REDEPLOY - chi dan nhanh"
  Write-Host ""
  Write-Host "Live:     $LiveUrl"
  Write-Host "Health:   $HealthUrl"
  Write-Host "Project:  tarot-bet-demo (Railway)"
  Write-Host "Volume:   /app/server/data  (KHONG ghi de bang git)"
  Write-Host ""
  Write-Host "Khi nao dung gi?"
  Write-Host "  (1) Typecheck     - truoc khi deploy (server + client tsc)"
  Write-Host "  (2) Deploy local  - railway up -c -y  * tin cay nhat"
  Write-Host "  (3) Full          - typecheck -> deploy -> verify"
  Write-Host "  (4) Verify live   - health + danh sach deployment"
  Write-Host "  (5) Status CLI    - whoami / status / deployment list"
  Write-Host "  (0) Thoat"
  Write-Host ""
  Write-Host "Luu y:"
  Write-Host "  - GitHub auto-deploy doi khi khong chay -> dung (2)"
  Write-Host "  - Khong commit: server/data/*.json, .env, studying/"
  Write-Host "  - Login Railway (mot lan):  npx @railway/cli@latest login"
  Write-Host "  - Sau Deploy complete: Ctrl+F5 tren trinh duyet"
  Write-Host ""
  Write-Host "Chay khong menu:"
  Write-Host "  .\scripts\redeploy.ps1 -Action deploy"
  Write-Host "  .\scripts\redeploy.ps1 -Action full"
  Write-Host "  npm run redeploy"
  Write-Host "  npm run redeploy:full"
  Write-Host ""
}

function Invoke-Typecheck {
  Write-Title "Typecheck"
  Write-Host "-> server..." -ForegroundColor Yellow
  Push-Location (Join-Path $Root "server")
  try {
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "Server typecheck failed (exit $LASTEXITCODE)" }
  } finally { Pop-Location }

  Write-Host "-> client..." -ForegroundColor Yellow
  Push-Location (Join-Path $Root "client")
  try {
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "Client typecheck failed (exit $LASTEXITCODE)" }
  } finally { Pop-Location }

  Write-Host "OK typecheck sach." -ForegroundColor Green
}

function Invoke-Deploy {
  Write-Title "Deploy Railway (upload local)"
  # PowerShell splat: avoid bare @pkg — use single-quoted package id.
  $cli = '@railway/cli@latest'
  Write-Host "Lenh: npx --yes $cli up -c -y" -ForegroundColor DarkGray
  Write-Host "Doi build... (co the 1-3 phut)" -ForegroundColor Yellow
  & npx.cmd --yes $cli up -c -y
  if ($LASTEXITCODE -ne 0) { throw "railway up failed (exit $LASTEXITCODE)" }
  Write-Host "Deploy CLI xong - kiem tra SUCCESS ben duoi / dashboard." -ForegroundColor Green
}

function Invoke-Verify {
  Write-Title "Verify live"
  $cli = '@railway/cli@latest'
  Write-Host "-> deployment list" -ForegroundColor Yellow
  & npx.cmd --yes $cli deployment list --limit 3

  Write-Host ""
  Write-Host "-> GET $HealthUrl" -ForegroundColor Yellow
  try {
    $raw = (Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 25).Content
    Write-Host $raw -ForegroundColor Green
    $h = $raw | ConvertFrom-Json
    if ($h.ready -eq $true -or $h.ok -eq $true) {
      Write-Host "Live OK | uptime=$($h.uptimeSec)s | $LiveUrl" -ForegroundColor Green
    } else {
      Write-Host "Health tra JSON nhung ready/ok chua True - doi them vai giay." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Health chua len: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Doi 30-60s roi chay lai: npm run redeploy:verify" -ForegroundColor Yellow
  }
}

function Invoke-Status {
  Write-Title "Railway status"
  $cli = '@railway/cli@latest'
  & npx.cmd --yes $cli whoami
  & npx.cmd --yes $cli status
  & npx.cmd --yes $cli deployment list --limit 5
}

function Show-Menu {
  Write-Help
  while ($true) {
    Write-Host ""
    Write-Host "Chon (0-5): " -NoNewline -ForegroundColor Cyan
    $choice = (Read-Host).Trim()
    switch ($choice) {
      "1" { Invoke-Typecheck }
      "2" { Invoke-Deploy }
      "3" {
        Invoke-Typecheck
        Invoke-Deploy
        Start-Sleep -Seconds 20
        Invoke-Verify
      }
      "4" { Invoke-Verify }
      "5" { Invoke-Status }
      "0" { Write-Host "Bye."; return }
      "h" { Write-Help }
      "help" { Write-Help }
      default { Write-Host "Khong hop le. Go 0-5 hoac help." -ForegroundColor Yellow }
    }
  }
}

try {
  switch ($Action) {
    "help"   { Write-Help }
    "check"  { Invoke-Typecheck }
    "deploy" { Invoke-Deploy }
    "verify" { Invoke-Verify }
    "status" { Invoke-Status }
    "full"   {
      Invoke-Typecheck
      Invoke-Deploy
      Start-Sleep -Seconds 20
      Invoke-Verify
    }
    default  { Show-Menu }
  }
} catch {
  Write-Host ""
  Write-Host "LOI: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}