# Recarga mensajes históricos desde Waha (todos los chats en BD).
# Requiere whatsapp-proxy desplegado con action messages.sync_history.
#
# Uso:
#   .\scripts\sync-whatsapp-history.ps1

$ErrorActionPreference = "Stop"

$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }
$RepoRoot = Split-Path -Parent $PSScriptRoot
$localScript = Join-Path $RepoRoot "scripts\sync-whatsapp-history-remote.sh"
$remoteScript = "/tmp/sync-whatsapp-history.sh"

$content = [System.IO.File]::ReadAllText($localScript).Replace("`r`n", "`n")
[System.IO.File]::WriteAllText($localScript, $content)

Write-Host "Desplegando whatsapp-proxy ..." -ForegroundColor Green
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\deploy-edge-functions.ps1") whatsapp-proxy
if ($LASTEXITCODE -ne 0) { throw "deploy falló" }

Write-Host "Sincronizando histórico en servidor ..." -ForegroundColor Green
& scp $localScript "${SshTarget}:${remoteScript}"
if ($LASTEXITCODE -ne 0) { throw "scp falló" }

ssh $SshTarget "bash $remoteScript"
if ($LASTEXITCODE -ne 0) { throw "sync falló" }

Write-Host "Histórico recargado." -ForegroundColor Green
