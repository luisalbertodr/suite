# Configuracion unica: clave SSH para despliegues sin contraseña.
# Te pedira la contraseña de root UNA sola vez por servidor (solo en tu maquina).
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
  # Windows OpenSSH + PowerShell: -N "" falla ("Too many arguments"). Usar cmd.exe.
  cmd /c "ssh-keygen -t ed25519 -f `"$KeyPath`" -N `"`" -C suite-deploy"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$KeyPath.pub")) {
    throw "ssh-keygen no creo $KeyPath.pub (exit=$LASTEXITCODE)"
  }
} else {
  Write-Host "Ya existe $KeyPath" -ForegroundColor Yellow
}

function Install-PublicKey {
  param(
    [string]$Target,
    [string]$Label
  )
  # Si ya hay acceso por clave, no pedir contraseña.
  # Importante: no dejar que stderr de ssh aborte el script (ErrorAction Stop).
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  cmd /c "ssh -o BatchMode=yes -o ConnectTimeout=8 -i `"$KeyPath`" -o IdentitiesOnly=yes $Target echo ok 1>nul 2>nul"
  $probeOk = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $prevEap
  if ($probeOk) {
    Write-Host "Ya hay acceso por clave a $Label ($Target)" -ForegroundColor Green
    return
  }
  Write-Host "Copiando clave publica a $Label ($Target) - contraseña de root si la pide ..." -ForegroundColor Green
  # Comillas simples: PowerShell 5 no interpreta && ni >> del remoto.
  $remoteInstall = 'mkdir -p ~/.ssh; chmod 700 ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys'
  Get-Content "$KeyPath.pub" | ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no $Target $remoteInstall
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo copiar la clave a $Target (exit=$LASTEXITCODE)"
  }
}

Install-PublicKey -Target $SupabaseTarget -Label "Supabase"
if ($IncludeWeb) {
  Install-PublicKey -Target $WebTarget -Label "aaPanel web"
}

if (Test-Path $SshConfig) {
  $content = Get-Content $SshConfig -Raw
  if ($content -notmatch "(?m)^Host suite-supabase\b") {
    Add-Content -Path $SshConfig -Value "`n$SupabaseBlock"
    Write-Host "Anadido bloque suite-supabase a $SshConfig" -ForegroundColor Green
  }
  if ($IncludeWeb) {
    $content = Get-Content $SshConfig -Raw
    if ($content -notmatch "(?m)^Host suite-web\b") {
      Add-Content -Path $SshConfig -Value "`n$WebBlock"
      Write-Host "Anadido bloque suite-web a $SshConfig" -ForegroundColor Green
    }
  }
} else {
  $initial = if ($IncludeWeb) { "$SupabaseBlock`n`n$WebBlock" } else { $SupabaseBlock }
  Set-Content -Path $SshConfig -Value $initial
  Write-Host "Creado $SshConfig" -ForegroundColor Green
}

Write-Host "Probando Supabase ..." -ForegroundColor Green
ssh -o BatchMode=yes suite-supabase 'echo OK; hostname'

if ($IncludeWeb) {
  Write-Host "Probando aaPanel web ..." -ForegroundColor Green
  ssh -o BatchMode=yes suite-web 'echo OK; hostname'
}

Write-Host ""
Write-Host "Listo. Despliega con:" -ForegroundColor Green
Write-Host "  .\scripts\deploy-edge-functions.ps1 -AllWhatsapp" -ForegroundColor Cyan
Write-Host "  .\scripts\deploy-frontend.ps1" -ForegroundColor Cyan
if (-not $IncludeWeb) {
  Write-Host ""
  Write-Host 'Para aaPanel (192.168.99.112): .\scripts\setup-ssh-deploy.ps1 -IncludeWeb' -ForegroundColor Yellow
}
