# Sincroniza Dunasoft DBF -> legacy.* -> Suite (sin tocar catálogo/familias Medicina).
#
# Uso:
#   .\scripts\sync_dunasoft_dbf.ps1
#   .\scripts\sync_dunasoft_dbf.ps1 -SkipDbfImport   # solo promover (legacy ya importado)
#   .\scripts\sync_dunasoft_dbf.ps1 -DryRun

param(
    [switch]$SkipDbfImport,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$env:LEGACY_DBF_DIR = "C:\Users\OportoW11\Suite\Dunasoft\dbf"
$env:LEGACY_IMPORT_SCOPE = "all"
$env:LEGACY_DBF_ENCODING = "cp1252"
if (-not $env:IMPORT_BATCH) {
    $env:IMPORT_BATCH = "dunasoft-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"
}

Write-Host "LEGACY_DBF_DIR=$($env:LEGACY_DBF_DIR)"
Write-Host "IMPORT_BATCH=$($env:IMPORT_BATCH)"

Write-Host "`n--- Resumen antes ---"
python scripts/legacy_import_diff_summary.py

if (-not $SkipDbfImport) {
    Write-Host "`n--- Import DBF -> legacy.* (puede tardar mucho: PLANINC, FACCAB...) ---"
    if ($DryRun) {
        Write-Host "[dry-run] omitido legacy_dbf_import_wave1.py"
    } else {
        python scripts/legacy_dbf_import_wave1.py
    }
    Write-Host "`n--- Resumen tras import ---"
    python scripts/legacy_import_diff_summary.py
}

$pipeArgs = @(
    "scripts/legacy_import_pipeline.py",
    "--mode", "full",
    "--skip-catalog",
    "--include-fallback"
)
if ($DryRun) { $pipeArgs += "--dry-run" }

Write-Host "`n--- Promoción a Suite (sin catálogo; Medicina intacta) ---"
python @pipeArgs

Write-Host "`nListo."
