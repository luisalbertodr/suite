# Despliegue automático: agente VM + ficheros VFP sync (canal stylegetreservas).
# Requiere SMB a \\192.168.99.119\c$ (net use o copy-to-vm.ps1 previo).
#
# Uso:
#   cd C:\Users\OportoW11\Suite\suite
#   .\scripts\deploy-vfp-sync-vm.ps1

param(
    [string]$VmHost = "192.168.99.119",
    [string]$SyncToken = "",
    [string]$SyncUrl = "https://supabase.lipoout.com/functions/v1/style-reservas-sync"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SyncLocal = "C:\Duna\DunaWeb\sync"
$VfpLocal = Join-Path $RepoRoot "vfp"
$ExportProgs = "C:\Duna\Export\PROGS"

if (-not $SyncToken) {
    $envFile = Join-Path $RepoRoot ".env"
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^SUPABASE_DB_URL=(.+)$') {
                $dbUrl = $matches[1].Trim('"')
            }
        }
    }
    if ($dbUrl) {
        python -c @"
import psycopg2
conn = psycopg2.connect('$dbUrl')
cur = conn.cursor()
cur.execute('SELECT sync_token FROM public.style_reservas_sync_config LIMIT 1')
print(cur.fetchone()[0])
"@ | ForEach-Object { $SyncToken = $_.Trim() }
    }
}
if (-not $SyncToken) {
    throw "No se pudo resolver sync_token (pasa -SyncToken o configura SUPABASE_DB_URL en .env)"
}

$SuiteSyncRemote = "\\$VmHost\c$\SuiteSync"
$StyleRemote = "\\$VmHost\c$\Style-Dunasoft"

if (-not (Test-Path $SuiteSyncRemote)) {
    throw "Sin acceso SMB a $SuiteSyncRemote. Ejecuta: cd C:\Duna\DunaWeb\sync; .\copy-to-vm.ps1"
}

Write-Host "Subiendo agente + VFP sync a $VmHost ..." -ForegroundColor Green

$files = @(
    "duna_coexist_once.ps1", "duna_sync.py", "outbox_apply.py", "agenda_bridge_pull.py",
    "pg_connect.py", "requirements.txt", "env.vm.example", "run_coexist_hidden.vbs",
    "install-duna-coexist-task.ps1", "dunasoft_plan_lifecycle.py"
)
foreach ($f in $files) {
    $src = Join-Path $SyncLocal $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $SuiteSyncRemote $f) -Force
    }
}

$envPath = Join-Path $SuiteSyncRemote ".env"
$envLines = if (Test-Path $envPath) { Get-Content $envPath -Encoding UTF8 } else { @() }
$seen = @{}
$out = @()
foreach ($line in $envLines) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') { $out += $line; continue }
    if ($line -match '^\s*([^=]+)\s*=') {
        $key = $matches[1].Trim()
        if ($seen.ContainsKey($key)) { continue }
        $seen[$key] = $true
    }
    $out += $line
}
if (-not $seen.ContainsKey('STYLE_VFP_SYNC')) { $out += 'STYLE_VFP_SYNC=1' }
$out | Set-Content $envPath -Encoding UTF8

@(
    "SYNC_URL=$SyncUrl",
    "SYNC_TOKEN=$SyncToken",
    "SYNC_MAC=STYLE-VM",
    "SYNC_INTERVAL=30",
    ""
) | Set-Content (Join-Path $StyleRemote "SuiteSync.cfg") -Encoding ASCII

Copy-Item (Join-Path $VfpLocal "suite_full_unlock.prg") (Join-Path $StyleRemote "suite_full_unlock.prg") -Force
Copy-Item (Join-Path $VfpLocal "activar_suite_sync.prg") (Join-Path $StyleRemote "activar_suite_sync.prg") -Force
Copy-Item (Join-Path $VfpLocal "TestStyleSync.ps1") (Join-Path $StyleRemote "TestStyleSync.ps1") -Force
Copy-Item (Join-Path $VfpLocal "IniciarStyle.bat") (Join-Path $StyleRemote "IniciarStyle.bat") -Force
# No copiar suite_reservas_sync.prg: puede pisar la version embebida en suite_full_unlock.prg
$oldSync = Join-Path $StyleRemote "suite_reservas_sync.prg"
if (Test-Path $oldSync) { Remove-Item $oldSync -Force; Write-Host "Eliminado suite_reservas_sync.prg obsoleto" }

$progsDest = Join-Path $StyleRemote "PROGS"
New-Item -ItemType Directory -Force -Path $progsDest | Out-Null
Copy-Item (Join-Path $VfpLocal "patches\httpasp_validarlicencia.prg") (Join-Path $progsDest "httpasp_validarlicencia.patch.prg") -Force

$resp = curl.exe -s -X POST $SyncUrl -H "Content-Type: application/x-www-form-urlencoded" -d "id=$SyncToken&tag=stylegetreservas"
Write-Host "Smoke stylegetreservas: $resp"
Write-Host "OK. Token en SuiteSync.cfg: $SyncToken" -ForegroundColor Green
