# Cutover Style sync v1 -> v2 en producción.
#
# Uso:
#   .\scripts\cutover-style-sync-v2.ps1 -WhatIf
#   .\scripts\cutover-style-sync-v2.ps1 -NewExe "C:\Duna\ExportZ\Duna.exe"

param(
    [string]$StyleRemote = "",
    [string]$NewExe = "",
    [string]$CompanyId = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4",
    [switch]$WhatIf,
    [switch]$SkipExeDeploy,
    [switch]$SkipDisableEdge
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($StyleRemote)) {
    if (Test-Path "Z:\Style-Dunasoft") { $StyleRemote = "Z:\Style-Dunasoft" }
    else { $StyleRemote = "\\192.168.99.16\c$\Style-Dunasoft" }
}

Write-Host "=== cutover-style-sync-v2 ===" -ForegroundColor Cyan
Write-Host "Style: $StyleRemote"

if (-not $SkipExeDeploy -and $NewExe) {
    & (Join-Path $RepoRoot "scripts\verify-style-cutover.ps1") -NewExe $NewExe -StyleRemote $StyleRemote -Backup
    if (-not $WhatIf) {
        Copy-Item $NewExe (Join-Path $StyleRemote "Duna.exe") -Force
        Write-Host "OK Duna.exe desplegado" -ForegroundColor Green
    }
} else {
    Write-Host "Exe: sin cambio (v2 vía PROGS fallback)" -ForegroundColor Yellow
}

if (-not $WhatIf) {
    & (Join-Path $RepoRoot "scripts\setup-style-v2-test-fallback.ps1") -TestRoot $StyleRemote -DeployVm:$false
    Copy-Item (Join-Path $RepoRoot "vfp\suite_inbound_worker.prg") (Join-Path $StyleRemote "PROGS\suite_inbound_worker.prg") -Force
    Copy-Item (Join-Path $RepoRoot "vfp\suite_migrar_cola_sincro.prg") (Join-Path $StyleRemote "PROGS\suite_migrar_cola_sincro.prg") -Force

    $controlDbf = Join-Path $StyleRemote "control_sincro.dbf"
    if (-not (Test-Path $controlDbf)) {
        Copy-Item (Join-Path $RepoRoot "vfp\suite_control_sync.prg") (Join-Path $StyleRemote "PROGS\suite_control_sync.prg") -Force
        Write-Host "AVISO: ejecuta en VFP DO PROGS\suite_control_sync.prg para crear control_sincro.dbf modo_activo=2" -ForegroundColor Yellow
    }

    foreach ($svc in @("SuiteSync", "StyleSuiteSync")) {
        $task = Get-ScheduledTask -TaskName $svc -ErrorAction SilentlyContinue
        if ($task) {
            Disable-ScheduledTask -TaskName $svc -ErrorAction SilentlyContinue
            Write-Host "OK deshabilitada tarea $svc" -ForegroundColor Green
        }
    }
    if (Test-Path "C:\SuiteSync") {
        Write-Host "AVISO: revisar servicio C:\SuiteSync manualmente en la VM" -ForegroundColor Yellow
    }
}

if (-not $SkipDisableEdge) {
    Write-Host "Edge style-reservas-sync: deshabilitar en whatsapp_config / nginx si aplica" -ForegroundColor Yellow
    Write-Host "  Renombrar en servidor: volumes/functions/style-reservas-sync -> style-reservas-sync.disabled" -ForegroundColor DarkGray
    if (-not $WhatIf) {
        ssh -i "$env:USERPROFILE\.ssh\suite_deploy" suite-supabase @"
if [ -d /root/supabase-project/volumes/functions/style-reservas-sync ]; then
  mv /root/supabase-project/volumes/functions/style-reservas-sync /root/supabase-project/volumes/functions/style-reservas-sync.disabled 2>/dev/null || true
  docker restart supabase-edge-functions
  echo OK edge style-reservas-sync deshabilitado
else
  echo INFO ya deshabilitado o no existe
fi
"@
    }
}

if (-not $WhatIf) {
    & (Join-Path $RepoRoot "scripts\deploy-style-sync-phase1.ps1") -SkipMigrations
}

Write-Host ""
Write-Host "Cutover completado. Ejecuta verify-style-sync-e2e.ps1" -ForegroundColor Green
