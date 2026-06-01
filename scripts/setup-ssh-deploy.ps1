# Configuración única: clave SSH para despliegues sin contraseña.
# Te pedirá la contraseña de root UNA sola vez por servidor (solo en tu máquina).
#
# Uso:
#   .\scripts\setup-ssh-deploy.ps1                  # Supabase (192.168.99.110)
#   .\scripts\setup-ssh-deploy.ps1 -IncludeWeb      # Supabase + aaPanel web (192.168.99.112)

param(
  [switch]$IncludeWeb
)

$ErrorActionPreference = "Stop"

$SupabaseTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "root@192.168.99.110" }
$WebTarget = if ($env:SUITE_WEB_SSH_SETUP) { $env:SUITE_WEB_SSH_SETUP } else { "root@192.168.99.112" }
$KeyPath = Join-Path $env:USERPROFILE ".ssh\suite_deploy"
$SshConfig = Join-Path $env:USERPROFILE ".ssh\config"

$SupabaseBlock = @"
Host suite-supabase
  HostName 192.168.99.110
  User root
  IdentityFile ~/.ssh/suite_deploy
  IdentitiesOnly yes
"@

$WebBlock = @"
Host suite-web
  HostName 192.168.99.112
  User root
  IdentityFile ~/.ssh/suite_deploy
  IdentitiesOnly yes
"@

if (-not (Test-Path (Split-Path $KeyPath))) {
  New-Item -ItemType Directory -Path (Split-Path $KeyPath) -Force | Out-Null
}

if (-not (Test-Path $KeyPath)) {
  Write-Host "Generando clave en $KeyPath ..." -ForegroundColor Green
  ssh-keygen -t ed25519 -f $KeyPath -N "" -C "suite-deploy"
} else {
  Write-Host "Ya existe $KeyPath" -ForegroundColor Yellow
}

function Install-PublicKey {
  param([string]$Target)
  Write-Host "Copiando clave pública a $Target (contraseña de root si la pide) ..." -ForegroundColor Green
  Get-Content "$KeyPath.pub" | ssh $Target "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
}

Install-PublicKey -Target $SupabaseTarget
if ($IncludeWeb) {
  Install-PublicKey -Target $WebTarget
}

if (Test-Path $SshConfig) {
  $content = Get-Content $SshConfig -Raw
  if ($content -notmatch "Host suite-supabase") {
    Add-Content -Path $SshConfig -Value "`n$SupabaseBlock"
    Write-Host "Añadido bloque suite-supabase a $SshConfig" -ForegroundColor Green
  }
  if ($IncludeWeb -and $content -notmatch "Host suite-web") {
    Add-Content -Path $SshConfig -Value "`n$WebBlock"
    Write-Host "Añadido bloque suite-web a $SshConfig" -ForegroundColor Green
  }
} else {
  $initial = if ($IncludeWeb) { "$SupabaseBlock`n`n$WebBlock" } else { $SupabaseBlock }
  Set-Content -Path $SshConfig -Value $initial
  Write-Host "Creado $SshConfig" -ForegroundColor Green
}

Write-Host "Probando Supabase ..." -ForegroundColor Green
ssh -o BatchMode=yes suite-supabase "echo OK && hostname"

if ($IncludeWeb) {
  Write-Host "Probando aaPanel web ..." -ForegroundColor Green
  ssh -o BatchMode=yes suite-web "echo OK && hostname"
}

Write-Host ""
Write-Host "Listo. Despliega con:" -ForegroundColor Green
Write-Host "  .\scripts\deploy-edge-functions.ps1 -AllWhatsapp" -ForegroundColor Cyan
Write-Host "  .\scripts\deploy-frontend.ps1" -ForegroundColor Cyan
if (-not $IncludeWeb) {
  Write-Host ""
  Write-Host "Para aaPanel (192.168.99.112): .\scripts\setup-ssh-deploy.ps1 -IncludeWeb" -ForegroundColor Yellow
}
