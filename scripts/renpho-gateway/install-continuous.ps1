# Instala config + systemd de ble-scale-sync en el gateway (mail / 192.168.99.112).
# Uso:
#   .\scripts\renpho-gateway\install-continuous.ps1
#   .\scripts\renpho-gateway\install-continuous.ps1 -SshTarget suite-web
#
# Modo on-demand: ble-scale-sync solo corre mientras hay «Pesar» (+ 10 min gracia).
# El controlador suite-ble-ondemand.service hace el poll y start/stop.
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

$LocalDir = $PSScriptRoot
$configSrc = Join-Path $LocalDir "config.yaml"
$serviceSrc = Join-Path $LocalDir "ble-scale-sync.service"
$ondemandUnitSrc = Join-Path $LocalDir "suite-ble-ondemand.service"
$ondemandShSrc = Join-Path $LocalDir "suite-ble-ondemand.sh"
$watchdogSrc = Join-Path $LocalDir "suite-ble-gateway-watchdog.sh"
$restartSrc = Join-Path $LocalDir "restart-ble-safe.sh"

foreach ($f in @($configSrc, $serviceSrc, $ondemandUnitSrc, $ondemandShSrc, $watchdogSrc, $restartSrc)) {
  if (-not (Test-Path $f)) { throw "Falta $f" }
}

function Invoke-SuiteSsh {
  param([Parameter(Mandatory = $true)][string]$RemoteCommand)
  & ssh @SshArgs $SshTarget $RemoteCommand
  if ($LASTEXITCODE -ne 0) { throw "ssh falló (exit=$LASTEXITCODE): $RemoteCommand" }
}

Write-Host "Comprobando SSH $SshTarget ..." -ForegroundColor Green
Invoke-SuiteSsh "test -d '$RemoteDir' && hostname"

Write-Host "Subiendo config.yaml y units systemd ..." -ForegroundColor Green
& scp @SshArgs $configSrc "${SshTarget}:${RemoteDir}/config.yaml"
if ($LASTEXITCODE -ne 0) { throw "scp config.yaml falló" }
& scp @SshArgs $serviceSrc "${SshTarget}:/etc/systemd/system/ble-scale-sync.service"
if ($LASTEXITCODE -ne 0) { throw "scp ble-scale-sync.service falló" }
& scp @SshArgs $ondemandUnitSrc "${SshTarget}:/etc/systemd/system/suite-ble-ondemand.service"
if ($LASTEXITCODE -ne 0) { throw "scp suite-ble-ondemand.service falló" }

Write-Host "Subiendo parches gateway ..." -ForegroundColor Green
Invoke-SuiteSsh "mkdir -p '$RemoteDir/patches'"
$patchesDir = Join-Path $LocalDir "patches"
foreach ($p in @("suite-pending.ts", "renpho-msc04.ts", "apply-gateway-ble-fixes.py", "connection-dbus-limits.ts")) {
  $src = Join-Path $patchesDir $p
  if (-not (Test-Path $src)) {
    if ($p -eq "connection-dbus-limits.ts") { continue }
    throw "Falta parche $src"
  }
  & scp @SshArgs $src "${SshTarget}:${RemoteDir}/patches/$p"
  if ($LASTEXITCODE -ne 0) { throw "scp $p falló" }
}
Invoke-SuiteSsh "sed -i 's/\r$//' '$RemoteDir/patches/'*.py '$RemoteDir/patches/'*.ts 2>/dev/null; python3 '$RemoteDir/patches/apply-gateway-ble-fixes.py'"

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
$envBodyUnix = ($envBody -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd() + "`n"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($envBodyUnix))
Invoke-SuiteSsh "echo $b64 | base64 -d > '$RemoteDir/.env' && chmod 600 '$RemoteDir/.env'"

Write-Host "Validando config ..." -ForegroundColor Green
Invoke-SuiteSsh "cd '$RemoteDir' && set -a && . ./.env && set +a && npm run validate"

Write-Host "Instalando ondemand + watchdog ..." -ForegroundColor Green
& scp @SshArgs $ondemandShSrc $watchdogSrc $restartSrc "${SshTarget}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw "scp scripts falló" }

$remoteInstall = @'
set -e
sed -i 's/\r$//' /tmp/suite-ble-ondemand.sh /tmp/suite-ble-gateway-watchdog.sh /tmp/restart-ble-safe.sh
install -m 755 /tmp/suite-ble-ondemand.sh /usr/local/bin/suite-ble-ondemand.sh
install -m 755 /tmp/suite-ble-gateway-watchdog.sh /usr/local/bin/suite-ble-gateway-watchdog.sh
install -m 755 /tmp/restart-ble-safe.sh /usr/local/bin/restart-ble-safe.sh
mkdir -p /var/lib/suite-ble-ondemand /var/lib/suite-ble-watchdog /var/log/suite
systemctl daemon-reload
# ble-scale-sync: no enable en boot; parar si está corriendo sin pending (ondemand lo gestiona).
systemctl disable ble-scale-sync.service 2>/dev/null || true
systemctl stop ble-scale-sync.service 2>/dev/null || true
systemctl reset-failed ble-scale-sync.service 2>/dev/null || true
systemctl enable --now suite-ble-ondemand.service
# Watchdog cron
(crontab -l 2>/dev/null | grep -v suite-ble-gateway-watchdog || true; echo '* * * * * /usr/local/bin/suite-ble-gateway-watchdog.sh') | crontab -
sleep 2
systemctl --no-pager --full status suite-ble-ondemand.service | head -20
systemctl is-active suite-ble-ondemand
systemctl is-active ble-scale-sync || echo 'ble-scale-sync inactive (esperado sin Pesar)'
tail -10 /var/log/suite/ble-ondemand.log || true
'@
$remoteInstallUnix = $remoteInstall -replace "`r`n", "`n" -replace "`r", "`n"
$remoteB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteInstallUnix))
Invoke-SuiteSsh "echo $remoteB64 | base64 -d | bash"

Write-Host ""
Write-Host "OK: on-demand BLE en $SshTarget" -ForegroundColor Green
Write-Host "Prueba: Suite → Pesar → journalctl -u suite-ble-ondemand -u ble-scale-sync -f" -ForegroundColor DarkGray
