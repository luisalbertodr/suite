# Instala config + systemd de ble-scale-sync en el gateway (mail / 192.168.99.112).
# Uso:
#   .\scripts\renpho-gateway\install-continuous.ps1
#   .\scripts\renpho-gateway\install-continuous.ps1 -SshTarget suite-web
#
param(
  [string]$SshTarget = $(if ($env:SUITE_RENHO_SSH_HOST) { $env:SUITE_RENHO_SSH_HOST } elseif ($env:SUITE_WEB_SSH_HOST) { $env:SUITE_WEB_SSH_HOST } else { "suite-web" }),
  [string]$RemoteDir = "/root/renpho-gateway/ble-scale-sync",
  [string]$ScaleIngestSecret = $(if ($env:SCALE_INGEST_SECRET) { $env:SCALE_INGEST_SECRET } else { "Bixb5KAmYw13lrlz5zbU5zlcEQjdjM4m" }),
  [string]$CompanyId = $(if ($env:SUITE_COMPANY_ID) { $env:SUITE_COMPANY_ID } else { "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4" })
)

$ErrorActionPreference = "Stop"
$IdentityFile = Join-Path $env:USERPROFILE ".ssh\suite_deploy"
$SshArgs = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=15")
if (Test-Path $IdentityFile) {
  $SshArgs += @("-i", $IdentityFile, "-o", "IdentitiesOnly=yes")
}

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $PSScriptRoot "config.yaml"))) {
  # script vive en scripts/renpho-gateway
}
$LocalDir = $PSScriptRoot
$configSrc = Join-Path $LocalDir "config.yaml"
$serviceSrc = Join-Path $LocalDir "ble-scale-sync.service"
if (-not (Test-Path $configSrc)) { throw "Falta $configSrc" }
if (-not (Test-Path $serviceSrc)) { throw "Falta $serviceSrc" }

function Invoke-SuiteSsh {
  param([Parameter(Mandatory = $true)][string]$RemoteCommand)
  & ssh @SshArgs $SshTarget $RemoteCommand
  if ($LASTEXITCODE -ne 0) { throw "ssh falló (exit=$LASTEXITCODE): $RemoteCommand" }
}

Write-Host "Comprobando SSH $SshTarget ..." -ForegroundColor Green
Invoke-SuiteSsh "test -d '$RemoteDir' && hostname"

Write-Host "Subiendo config.yaml y unit systemd ..." -ForegroundColor Green
& scp @SshArgs $configSrc "${SshTarget}:${RemoteDir}/config.yaml"
if ($LASTEXITCODE -ne 0) { throw "scp config.yaml falló" }
& scp @SshArgs $serviceSrc "${SshTarget}:/etc/systemd/system/ble-scale-sync.service"
if ($LASTEXITCODE -ne 0) { throw "scp unit falló" }

# .env con secretos (no versionar valores reales en git si se regenera)
# Conserva SCALE_MACS si ya existe en remoto; si no, usa ambas MorphoScan por defecto.
$defaultMacs = "60:30:F2:74:26:E2,60:30:F2:74:22:B6"
$existingMacs = (& ssh @SshArgs $SshTarget "grep -E '^SCALE_MACS=' '$RemoteDir/.env' 2>/dev/null | cut -d= -f2-").Trim()
$scaleMacs = if ($existingMacs) { $existingMacs } else { $defaultMacs }
$envBody = @"
SCALE_INGEST_SECRET=$ScaleIngestSecret
SUITE_COMPANY_ID=$CompanyId
SCALE_INGEST_URL=https://supabase.lipoout.com/functions/v1/scale-ingest
SCALE_MACS=$scaleMacs
CONTINUOUS_MODE=true
"@
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($envBody))
Invoke-SuiteSsh "echo $b64 | base64 -d > '$RemoteDir/.env' && chmod 600 '$RemoteDir/.env'"

Write-Host "Validando config (debe reportar >=1 exporter) ..." -ForegroundColor Green
Invoke-SuiteSsh "cd '$RemoteDir' && set -a && . ./.env && set +a && npm run validate"

Write-Host "Activando servicio systemd continuo ..." -ForegroundColor Green
Invoke-SuiteSsh "systemctl daemon-reload && systemctl enable --now ble-scale-sync.service && sleep 2 && systemctl --no-pager --full status ble-scale-sync.service | head -25"

Write-Host "Últimas líneas de log:" -ForegroundColor Cyan
Invoke-SuiteSsh "journalctl -u ble-scale-sync.service -n 30 --no-pager"

Write-Host ""
Write-Host "OK: bridge continuo en $SshTarget" -ForegroundColor Green
Write-Host "Prueba: Suite → Pesar ahora → subir a la báscula → buscar 'Webhook delivered' en journalctl -u ble-scale-sync -f" -ForegroundColor DarkGray
