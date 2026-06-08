# Despliegue automático agente + ficheros VFP sync a VM 119 (SMB).
# Ejecutar desde PowerShell en el portátil (requiere net use previo o contraseña).

$ErrorActionPreference = "Stop"
$VmHost = "192.168.99.119"
$SyncToken = "ec68f87cdbf6f2bbc4045ddda366d0251560e227ccb39608"
$SyncUrl = "https://supabase.lipoout.com/functions/v1/style-reservas-sync"

$SuiteSyncRemote = "\\$VmHost\c$\SuiteSync"
$StyleRemote = "\\$VmHost\c$\Style-Dunasoft"
$SyncLocal = "C:\Duna\DunaWeb\sync"
$VfpLocal = "C:\Users\OportoW11\Suite\suite\vfp"
$ExportProgs = "C:\Duna\Export\PROGS"

if (-not (Test-Path $SuiteSyncRemote)) {
    throw "No hay acceso SMB a $SuiteSyncRemote. Ejecuta copy-to-vm.ps1 o net use primero."
}

Write-Host "1) Copiando agente Python actualizado..." -ForegroundColor Green
$files = @(
    "duna_coexist_once.ps1",
    "duna_sync.py",
    "outbox_apply.py",
    "agenda_bridge_pull.py",
    "pg_connect.py",
    "requirements.txt",
    "env.vm.example",
    "run_coexist_hidden.vbs",
    "install-duna-coexist-task.ps1"
)
foreach ($f in $files) {
    $src = Join-Path $SyncLocal $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $SuiteSyncRemote $f) -Force
    }
}

Write-Host "2) Actualizando C:\SuiteSync\.env (STYLE_VFP_SYNC=1)..." -ForegroundColor Green
$envPath = Join-Path $SuiteSyncRemote ".env"
$envLines = @()
if (Test-Path $envPath) {
    $envLines = Get-Content $envPath -Encoding UTF8
}
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
if (-not $seen.ContainsKey('LEGACY_COMPANY_ID')) { $out += 'LEGACY_COMPANY_ID=5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' }
$out | Set-Content $envPath -Encoding UTF8

Write-Host "3) SuiteSync.cfg en Style-Dunasoft..." -ForegroundColor Green
$cfg = @(
    "SYNC_URL=$SyncUrl",
    "SYNC_TOKEN=$SyncToken",
    "SYNC_MAC=STYLE-VM",
    "SYNC_INTERVAL=30",
    ""
)
$cfg | Set-Content (Join-Path $StyleRemote "SuiteSync.cfg") -Encoding ASCII

Write-Host "4) suite_reservas_sync.prg + parches PROGS..." -ForegroundColor Green
Copy-Item (Join-Path $VfpLocal "suite_reservas_sync.prg") (Join-Path $StyleRemote "suite_reservas_sync.prg") -Force

$progsDest = Join-Path $StyleRemote "PROGS"
if (-not (Test-Path $progsDest)) {
    New-Item -ItemType Directory -Path $progsDest | Out-Null
}
Copy-Item (Join-Path $ExportProgs "suite_reservas_sync.prg") (Join-Path $progsDest "suite_reservas_sync.prg") -Force
Copy-Item (Join-Path $ExportProgs "funciones.prg") (Join-Path $StyleRemote "funciones.prg") -Force
Copy-Item (Join-Path $VfpLocal "activar_suite_sync.prg") (Join-Path $StyleRemote "activar_suite_sync.prg") -Force
Copy-Item (Join-Path $VfpLocal "patches\httpasp_validarlicencia.prg") (Join-Path $progsDest "httpasp_validarlicencia.patch.prg") -Force

Write-Host "5) Smoke test Edge Function..." -ForegroundColor Green
$resp = curl.exe -s -X POST $SyncUrl -H "Content-Type: application/x-www-form-urlencoded" -d "id=$SyncToken&tag=stylegetreservas"
Write-Host "   stylegetreservas -> $resp"

Write-Host ""
Write-Host "OK despliegue automatico completado." -ForegroundColor Green
