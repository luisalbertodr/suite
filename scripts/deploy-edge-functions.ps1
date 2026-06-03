# Despliega Edge Functions al Supabase self-hosted (192.168.99.110).
# Requiere acceso SSH sin contraseña (clave pública en el servidor).
#
# Uso:
#   .\scripts\deploy-edge-functions.ps1 whatsapp-webhook whatsapp-proxy
#   .\scripts\deploy-edge-functions.ps1 -AllWhatsapp
#   .\scripts\deploy-edge-functions.ps1 -RestartOnly
#
# Configuración opcional (variables de entorno):
#   $env:SUITE_SSH_HOST = "root@192.168.99.110"
#   $env:SUITE_FUNCTIONS_PATH = "/root/supabase-project/volumes/functions"
#   $env:SUITE_EDGE_CONTAINER = "supabase-edge-functions"

param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Functions,

  [switch]$AllWhatsapp,
  [switch]$RestartOnly,
  [switch]$SkipRestart
)

$ErrorActionPreference = "Stop"

$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }
$RemoteFunctionsPath = if ($env:SUITE_FUNCTIONS_PATH) {
  $env:SUITE_FUNCTIONS_PATH
} else {
  "/root/supabase-project/volumes/functions"
}
$Container = if ($env:SUITE_EDGE_CONTAINER) {
  $env:SUITE_EDGE_CONTAINER
} else {
  "supabase-edge-functions"
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Test-SshKeyAuth {
  $null = ssh -o BatchMode=yes -o ConnectTimeout=8 $SshTarget "echo ok" 2>&1
  return $LASTEXITCODE -eq 0
}

if (-not (Test-SshKeyAuth)) {
  Write-Host ""
  Write-Host "No hay acceso SSH por clave a $SshTarget." -ForegroundColor Yellow
  Write-Host "Configuralo una vez (sin compartir contraseña con nadie):" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  ssh-keygen -t ed25519 -f `"$env:USERPROFILE\.ssh\suite_deploy`" -N `"`" -C suite-edge-deploy" -ForegroundColor Cyan
  Write-Host "  type `"$env:USERPROFILE\.ssh\suite_deploy.pub`" | ssh $SshTarget `"mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`"" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Luego añade a $env:USERPROFILE\.ssh\config :" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  Host suite-supabase" -ForegroundColor Cyan
  Write-Host "    HostName 192.168.99.110" -ForegroundColor Cyan
  Write-Host "    User root" -ForegroundColor Cyan
  Write-Host "    IdentityFile ~/.ssh/suite_deploy" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Y ejecuta: `$env:SUITE_SSH_HOST='root@192.168.99.110' o usa Host suite-supabase" -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

$toDeploy = @()
if ($AllWhatsapp) {
  $toDeploy = @("whatsapp-webhook", "whatsapp-proxy")
} elseif ($Functions.Count -gt 0) {
  $toDeploy = $Functions
} elseif (-not $RestartOnly) {
  Write-Host "Indica funciones: .\scripts\deploy-edge-functions.ps1 whatsapp-webhook" -ForegroundColor Red
  exit 1
}

foreach ($name in $toDeploy) {
  $localDir = Join-Path $RepoRoot "supabase\functions\$name"
  if (-not (Test-Path $localDir)) {
    throw "No existe: $localDir"
  }
  Write-Host "Subiendo $name ..." -ForegroundColor Green
  & scp -r $localDir "${SshTarget}:${RemoteFunctionsPath}/"
  if ($LASTEXITCODE -ne 0) { throw "scp falló para $name" }
}

$sharedDir = Join-Path $RepoRoot "supabase\functions\_shared"
if ($toDeploy.Count -gt 0 -and (Test-Path $sharedDir)) {
  Write-Host "Subiendo _shared ..." -ForegroundColor Green
  & scp -r $sharedDir "${SshTarget}:${RemoteFunctionsPath}/"
  if ($LASTEXITCODE -ne 0) { throw "scp falló para _shared" }
}

if (-not $SkipRestart) {
  Write-Host "Reiniciando $Container ..." -ForegroundColor Green
  ssh $SshTarget "docker restart $Container && sleep 2 && docker logs --tail 15 $Container"
  if ($LASTEXITCODE -ne 0) { throw "docker restart falló" }
  # Kong cachea la IP de `functions`; sin esto → 502 en /functions/v1/*
  Write-Host "Reiniciando supabase-kong (DNS edge) ..." -ForegroundColor Green
  ssh $SshTarget "docker restart supabase-kong"
  if ($LASTEXITCODE -ne 0) { throw "docker restart kong falló" }
}

Write-Host "Despliegue completado." -ForegroundColor Green
