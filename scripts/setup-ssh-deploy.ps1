# Configuración única: clave SSH para despliegues sin contraseña.
# Te pedirá la contraseña de root UNA sola vez (solo en tu máquina).

$ErrorActionPreference = "Stop"

$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "root@192.168.99.110" }
$KeyPath = Join-Path $env:USERPROFILE ".ssh\suite_deploy"
$SshConfig = Join-Path $env:USERPROFILE ".ssh\config"

if (-not (Test-Path (Split-Path $KeyPath))) {
  New-Item -ItemType Directory -Path (Split-Path $KeyPath) -Force | Out-Null
}

if (-not (Test-Path $KeyPath)) {
  Write-Host "Generando clave en $KeyPath ..." -ForegroundColor Green
  ssh-keygen -t ed25519 -f $KeyPath -N "" -C "suite-edge-deploy"
} else {
  Write-Host "Ya existe $KeyPath" -ForegroundColor Yellow
}

Write-Host "Copiando clave pública al servidor (introduce la contraseña de root si la pide) ..." -ForegroundColor Green
Get-Content "$KeyPath.pub" | ssh $SshTarget "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

$block = @"

Host suite-supabase
  HostName 192.168.99.110
  User root
  IdentityFile ~/.ssh/suite_deploy
  IdentitiesOnly yes
"@

if (Test-Path $SshConfig) {
  $content = Get-Content $SshConfig -Raw
  if ($content -notmatch "Host suite-supabase") {
    Add-Content -Path $SshConfig -Value $block
    Write-Host "Añadido bloque suite-supabase a $SshConfig" -ForegroundColor Green
  }
} else {
  Set-Content -Path $SshConfig -Value $block.TrimStart()
  Write-Host "Creado $SshConfig" -ForegroundColor Green
}

Write-Host "Probando conexión ..." -ForegroundColor Green
ssh -o BatchMode=yes suite-supabase "echo OK && hostname"

Write-Host ""
Write-Host "Listo. Despliega con:" -ForegroundColor Green
Write-Host '  $env:SUITE_SSH_HOST = "suite-supabase"' -ForegroundColor Cyan
Write-Host "  .\scripts\deploy-edge-functions.ps1 -AllWhatsapp" -ForegroundColor Cyan
