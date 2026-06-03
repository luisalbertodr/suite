# Importación completa Dunasoft DBF -> legacy.* -> Suite desde cero.
# Progreso en consola [n/N] y en Configuración → Importar (legacy_import_runs).
#
# Uso:
#   .\scripts\sync_dunasoft_from_zero.ps1
#   .\scripts\sync_dunasoft_from_zero.ps1 -SkipDbfImport
#   .\scripts\sync_dunasoft_from_zero.ps1 -Resume -RunId <uuid>

param(
    [switch]$SkipDbfImport,
    [switch]$DryRun,
    [switch]$Resume,
    [string]$RunId = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$env:PYTHONPATH = (Join-Path $PWD "scripts")

$env:LEGACY_DBF_DIR = "C:\Users\OportoW11\Suite\Dunasoft\dbf"
$env:LEGACY_IMPORT_SCOPE = "all"
$env:LEGACY_DBF_ENCODING = "cp1252"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUNBUFFERED = "1"
if (-not $env:IMPORT_BATCH) {
    $env:IMPORT_BATCH = "dunasoft-zero-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"
}

# Conexión Postgres (timeout + túnel si hace falta)
function Invoke-PythonStdout([string]$Code) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $lines = @(python -c $Code 2>&1)
        $url = $lines | Where-Object { $_ -match "^postgresql" } | Select-Object -First 1
        if ($url) { return $url.ToString().Trim() }
        $uuid = $lines | Where-Object { $_ -match "^[0-9a-f]{8}-" } | Select-Object -First 1
        if ($uuid) { return $uuid.ToString().Trim() }
        throw "Salida Python inesperada: $($lines -join ' | ')"
    } finally {
        $ErrorActionPreference = $prev
    }
}

$dbUrl = Invoke-PythonStdout "from legacy_import_progress import ensure_db_connection; print(ensure_db_connection())"
$env:SUPABASE_DB_URL = $dbUrl

if ($RunId) {
    $env:LEGACY_IMPORT_RUN_ID = $RunId
} elseif (-not $Resume) {
    $env:LEGACY_IMPORT_RUN_ID = Invoke-PythonStdout "from legacy_import_progress import create_legacy_import_run; print(create_legacy_import_run(mode='full', options={'skip_catalog':True,'no_invoices':True,'no_sales':True,'clean_import':True,'source':'sync_dunasoft_from_zero.ps1'}))"
}

Write-Host "IMPORT_BATCH=$($env:IMPORT_BATCH)"
Write-Host "LEGACY_DBF_DIR=$($env:LEGACY_DBF_DIR)"
Write-Host "LEGACY_IMPORT_RUN_ID=$($env:LEGACY_IMPORT_RUN_ID)"
Write-Host "Ver progreso: Suite -> Configuracion -> Importar (importacion legacy)"
Write-Host ""

$phase = 0
$phaseTotal = if ($SkipDbfImport) { 2 } else { 3 }

if (-not $SkipDbfImport) {
    $phase++
    Write-Host "=== Fase $phase/$phaseTotal : Import DBF completo -> legacy.* ===" -ForegroundColor Cyan
    python -c "from legacy_import_progress import set_run_progress; import os; set_run_progress(os.environ['LEGACY_IMPORT_RUN_ID'], $phase, $phaseTotal, 'Import DBF')"
    if ($DryRun) {
        Write-Host "[dry-run] omitido legacy_dbf_import_wave1.py"
    } else {
        python scripts/legacy_dbf_import_wave1.py
    }

    $phase++
    Write-Host "`n=== Fase $phase/$phaseTotal : Bonos articulos (BONOSART) ===" -ForegroundColor Cyan
    python -c "from legacy_import_progress import set_run_progress; import os; set_run_progress(os.environ['LEGACY_IMPORT_RUN_ID'], $phase, $phaseTotal, 'Bonos articulos')"
    if (-not $DryRun) { python scripts/import_legacy_bonosart.py }
}

$phase++
Write-Host "`n=== Fase $phase/$phaseTotal : Promocion Suite (sin catalogo ni facturas) ===" -ForegroundColor Cyan
python -c "from legacy_import_progress import set_run_progress; import os; set_run_progress(os.environ['LEGACY_IMPORT_RUN_ID'], $phase, $phaseTotal, 'Promocion pipeline')"

$pipeArgs = @(
    "scripts/legacy_import_pipeline.py",
    "--mode", "full",
    "--skip-catalog",
    "--no-invoices",
    "--no-sales",
    "--clean-import",
    "--run-id", $env:LEGACY_IMPORT_RUN_ID
)
if ($DryRun) { $pipeArgs += "--dry-run" }
if ($Resume) { $pipeArgs += "--resume" }

python @pipeArgs

Write-Host "`nCompletado. Run ID: $($env:LEGACY_IMPORT_RUN_ID)" -ForegroundColor Green
Write-Host "Estado final en Configuracion -> Importar (legacy_import_runs)." -ForegroundColor Green
