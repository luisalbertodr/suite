# Copia Duna.exe a Style-Dunasoft (VM).
param(
    [string]$StyleDrive = "",
    [switch]$SkipVerify,
    [switch]$RemoveUnlockFallback
)

$ErrorActionPreference = "Stop"
$ExportRoot = if ($env:SUITE_EXPORT_ROOT) { $env:SUITE_EXPORT_ROOT.TrimEnd('\') } else { "C:\Duna\Export" }
$ExportExe = Join-Path $ExportRoot "Duna.exe"

function Get-LatestBuildExe {
    param([string]$Root)
    $names = @("mscomctlOk.exe", "mscomctl.exe", "Duna2.exe", "DunaNew.exe", "Duna.exe")
    $items = foreach ($n in $names) {
        $p = Join-Path $Root $n
        if (Test-Path $p) { Get-Item $p }
    }
    if (-not $items) { return $null }
    return ($items | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
}

$buildSrc = Get-LatestBuildExe $ExportRoot
if ($buildSrc) {
    $ExportExe = $buildSrc.FullName
    Write-Host "Origen build: $($buildSrc.Name) ($($buildSrc.LastWriteTime))" -ForegroundColor DarkGray
}

$candidates = @()
if ($StyleDrive) { $candidates += $StyleDrive.TrimEnd('\') }
if ($env:SUITE_STYLE_ROOT) { $candidates += $env:SUITE_STYLE_ROOT.TrimEnd('\') }
$candidates += @(
    "Z:\Style-Dunasoft",
    "C:\Style-Dunasoft",
    "\\192.168.99.16\c$\Style-Dunasoft"
)
$candidates = $candidates | Select-Object -Unique

$StyleRemote = $null
foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { $StyleRemote = $c; break }
}

if (-not (Test-Path $ExportExe)) {
    throw "No existe $ExportExe. Compila antes: BUILD-DUNA.bat + DO PROGS\VfpBuildProject.prg en VFP."
}
if (-not $StyleRemote) {
    throw @"
Sin acceso a Style-Dunasoft. Rutas probadas:
  $($candidates -join "`n  ")
Conecta la unidad Z: a la VM o define `$env:SUITE_STYLE_ROOT
  deploy-duna-exe-vm.ps1 -StyleDrive 'Z:\Style-Dunasoft'
"@
}

Write-Host "Destino: $StyleRemote" -ForegroundColor Cyan

$progs = Join-Path $StyleRemote "PROGS"
$backup = Join-Path $StyleRemote ("Duna.exe.bak-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

Write-Host "Backup remoto: $backup" -ForegroundColor Cyan
Copy-Item (Join-Path $StyleRemote "Duna.exe") $backup -Force -ErrorAction SilentlyContinue

Write-Host "Desplegando $ExportExe -> $StyleRemote\Duna.exe" -ForegroundColor Green
$localExe = Get-Item $ExportExe
Write-Host ("  Origen:  {0} bytes  {1}" -f $localExe.Length, $localExe.LastWriteTime) -ForegroundColor DarkGray
Copy-Item $ExportExe (Join-Path $StyleRemote "Duna.exe") -Force
Copy-Item $ExportExe (Join-Path $StyleRemote "Duna2.exe") -Force

foreach ($f in @("_menus.dbf", "_menus.cdx", "foxypreviewer_locs.dbf")) {
    $src = Join-Path $ExportRoot $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $StyleRemote $f) -Force
        Write-Host "$f -> VM (runtime arranque)" -ForegroundColor Cyan
    }
}

$StyleRuntime = Join-Path $ExportRoot "STYLE-RUNTIME"
if (Test-Path $StyleRuntime) {
    foreach ($f in @(
        "IniciarStyle.bat", "RecuperarSyncInbound.bat", "ensure-style-sync.ps1",
        "SuiteSyncAgent.cfg.example", "ensure-style-dbc.ps1",
        "activar_suite_sync.prg", "SuiteSync.cfg.example", "DiagnosticarSuiteSync.ps1", "TestStyleSync.ps1"
    )) {
        $src = Join-Path $StyleRuntime $f
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $StyleRemote $f) -Force
            Write-Host "STYLE-RUNTIME\$f -> VM" -ForegroundColor Cyan
        }
    }
}

$exportProgs = Join-Path $ExportRoot "PROGS"
$vcxSrc = Join-Path $ExportRoot "vcx"
$vcxDest = Join-Path $StyleRemote "vcx"
if (Test-Path $exportProgs) {
    New-Item -ItemType Directory -Force -Path $progs | Out-Null
    foreach ($f in @("suite_full_unlock.prg", "suite_full_unlock.fxp", "suite_full_unlock.FXP", "funciones.fxp", "funciones.FXP")) {
        $src = Join-Path $exportProgs $f
        if (Test-Path $src) {
            Copy-Item $src $progs -Force
            Write-Host "PROGS\$f -> VM (fallback sync/unlock)" -ForegroundColor Cyan
        }
    }
}
if (Test-Path $vcxSrc) {
    New-Item -ItemType Directory -Force -Path $vcxDest | Out-Null
    robocopy $vcxSrc $vcxDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    $vcxCount = @(Get-ChildItem $vcxDest -Filter "*.vcx" -ErrorAction SilentlyContinue).Count
    Write-Host "vcx\ ($vcxCount archivos) -> VM" -ForegroundColor Cyan
}

if ($RemoveUnlockFallback) {
$remove = @(
    (Join-Path $progs "suite_full_unlock.fxp"),
    (Join-Path $progs "suite_full_unlock.FXP"),
    (Join-Path $progs "suite_full_unlock.prg"),
    (Join-Path $progs "general.fxp"),
    (Join-Path $progs "general.FXP"),
    (Join-Path $StyleRemote "suite_full_unlock.fxp"),
    (Join-Path $StyleRemote "suite_full_unlock.prg"),
    (Join-Path $StyleRemote "general.fxp")
)
foreach ($f in $remove) {
    if (Test-Path $f) {
        Remove-Item $f -Force
        Write-Host "Eliminado fallback: $f" -ForegroundColor Yellow
    }
}
}

$cfg = Join-Path $StyleRemote "SuiteSync.cfg"
if (-not (Test-Path $cfg)) {
    Write-Host "AVISO: falta SuiteSync.cfg en $StyleRemote" -ForegroundColor Red
}

$local = Get-Item $ExportExe
$remote = Get-Item (Join-Path $StyleRemote "Duna.exe")
Write-Host ("OK  local={0} bytes  remoto={1} bytes" -f $local.Length, $remote.Length) -ForegroundColor Green

if (-not $SkipVerify) {
    $logPath = Join-Path $StyleRemote "Usuarios\_suite_sync.log"
    Write-Host @"

Siguiente en la VM (build VFP9, sin ReFox):
  1. Cerrar Style
  2. Doble clic en Duna.exe (IniciarStyle.bat opcional)
  3. Log: $logPath
     - [BOOT-00] ruta Style (debe ser carpeta del exe, no dbf\)
     - [BOOT-04] o [INIT-03] sync embebida

Si idioma/aniversarios fallan: el exe no lleva general.prg/funciones.prg parcheados.
  Rebuild: cd C:\Duna\Export && BUILD-DUNA.bat

"@ -ForegroundColor Cyan
}
