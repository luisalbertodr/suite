# Entorno test Style v2: exe limpio (Z:) + PRGs/FXP suite_cola_sync en PROGS (sin ReFox).
#
# Uso:
#   .\scripts\setup-style-v2-test-fallback.ps1
#   .\scripts\setup-style-v2-test-fallback.ps1 -DeployVm

param(
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$SourceExe = "",
    [string]$VmHost = "192.168.99.16",
    [switch]$DeployVm
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"
$TestRoot = [IO.Path]::GetFullPath($TestRoot.TrimEnd('\'))
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$ProgsExport = Join-Path $ExportRoot "PROGS"

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "=== $Msg ===" -ForegroundColor Cyan
}

if ([string]::IsNullOrWhiteSpace($SourceExe)) {
    foreach ($c in @("Z:\Style-Dunasoft\Duna.exe", (Join-Path $ExportRoot "Duna.exe"))) {
        if (Test-Path $c) { $SourceExe = $c; break }
    }
}
if (-not (Test-Path $SourceExe)) {
    throw "No hay Duna.exe base. Monta Z:\ o compila ExportZ."
}

Write-Step "setup-style-v2-test-fallback"
& (Join-Path $RepoRoot "scripts\build-style-exportz.ps1") -SkipRepair -Quiet 2>$null

$compile = Join-Path $ProgsExport "VfpCompileSuitePrgs.prg"
Copy-Item (Join-Path $VfpRepo "VfpCompileSuitePrgs.prg") $compile -Force
Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$env:SUITE_VFP_HEADLESS = "1"
try {
    $proc = Start-Process -FilePath $VfpExe -ArgumentList "`"$compile`"" -WorkingDirectory $ExportRoot -PassThru -WindowStyle Hidden
    $null = $proc.WaitForExit(120000)
} finally {
    Remove-Item Env:\SUITE_VFP_HEADLESS -ErrorAction SilentlyContinue
}
Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

foreach ($base in @("general", "funciones", "suite_cola_sync", "suite_control_sync")) {
    $err = Join-Path $ProgsExport "$base.ERR"
    if (Test-Path $err) { throw "Error compilando $base - ver $err" }
}

if (-not (Test-Path $TestRoot)) { New-Item -ItemType Directory -Path $TestRoot -Force | Out-Null }
Copy-Item $SourceExe (Join-Path $TestRoot "Duna.exe") -Force
Write-Host "  OK Duna.exe <- $SourceExe ($((Get-Item $SourceExe).Length) bytes)" -ForegroundColor Green

& (Join-Path $RepoRoot "scripts\setup-style-exportz-test.ps1") -DestRoot $TestRoot -ExportRoot $ExportRoot

$fpw = Join-Path $TestRoot "config.fpw"
Set-Content -Path $fpw -Value @(
    "DEFAULT=$TestRoot",
    "STARTUP=PROGS\suite_v2_startup.prg"
) -Encoding ASCII
Write-Host "  OK config.fpw STARTUP v2" -ForegroundColor Green

$testProgs = Join-Path $TestRoot "PROGS"
if (-not (Test-Path $testProgs)) { New-Item -ItemType Directory -Path $testProgs -Force | Out-Null }

$repoPrgs = @("general.prg", "funciones.prg", "suite_cola_sync.prg", "suite_control_sync.prg", "suite_inbound_worker.prg", "suite_v2_startup.prg")
foreach ($f in $repoPrgs) {
    Copy-Item (Join-Path $VfpRepo $f) (Join-Path $testProgs $f) -Force
}

$v2Files = @(
    "general.fxp", "funciones.fxp", "suite_cola_sync.fxp", "suite_control_sync.fxp",
    "general.FXP", "funciones.FXP", "suite_cola_sync.FXP", "suite_control_sync.FXP"
)
foreach ($f in $v2Files) {
    $src = Join-Path $ProgsExport $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $testProgs $f) -Force }
}
if (-not (Test-Path (Join-Path $testProgs "suite_cola_sync.fxp")) -and -not (Test-Path (Join-Path $testProgs "suite_cola_sync.FXP"))) {
    $compileTest = Join-Path $testProgs "_compile_suite.prg"
    @"
SET DEFAULT TO $TestRoot
SET PROCEDURE TO PROGS\VfpCompileSuitePrgs.prg ADDITIVE
DO PROGS\VfpCompileSuitePrgs
"@ | Set-Content -Path $compileTest -Encoding ASCII
    Copy-Item (Join-Path $VfpRepo "VfpCompileSuitePrgs.prg") (Join-Path $testProgs "VfpCompileSuitePrgs.prg") -Force
    Copy-Item (Join-Path $VfpRepo "VfpLoadRepairLib.prg") (Join-Path $testProgs "VfpLoadRepairLib.prg") -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $VfpRepo "suite_repair_lib.prg") (Join-Path $testProgs "suite_repair_lib.prg") -Force -ErrorAction SilentlyContinue
    Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $env:SUITE_VFP_HEADLESS = "1"
    try {
        $proc = Start-Process -FilePath $VfpExe -ArgumentList "`"$compileTest`"" -WorkingDirectory $TestRoot -PassThru -WindowStyle Hidden
        $null = $proc.WaitForExit(120000)
    } finally {
        Remove-Item Env:\SUITE_VFP_HEADLESS -ErrorAction SilentlyContinue
    }
    Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Remove-Item $compileTest -Force -ErrorAction SilentlyContinue
}
foreach ($bad in @("suite_full_unlock.fxp", "suite_full_unlock.FXP")) {
    $p = Join-Path $testProgs $bad
    if (Test-Path $p) { Remove-Item $p -Force }
}

$syncDirs = @("sync\inbound", "sync\inbound_ack", "sync\archive", "sync\deadletter", "sync\archive\failed")
foreach ($d in $syncDirs) {
    $p = Join-Path $TestRoot $d
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

$bat = @"
@echo off
setlocal
set "STYLE_HOME=%~dp0"
cd /d "%STYLE_HOME%"
set "STYLE_HOME=%CD%"
if exist "%~dp0ensure-style-dbc.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-style-dbc.ps1" -StyleRoot "%CD%" -RemoveWedbRootOnly 2>nul
)
if not exist "%CD%\Duna.exe" (echo ERROR: falta Duna.exe & pause & exit /b 1)
if not exist SuiteSync.cfg (echo ERROR: falta SuiteSync.cfg & pause & exit /b 1)
if not exist Usuarios mkdir Usuarios 2>nul
if exist "%CD%\PROGS\suite_full_unlock.fxp" del /Q "%CD%\PROGS\suite_full_unlock.fxp" 2>nul
if exist "%CD%\PROGS\suite_full_unlock.FXP" del /Q "%CD%\PROGS\suite_full_unlock.FXP" 2>nul
echo Style v2 test (PROGS fallback): %CD%
echo Log: Usuarios\_suite_sync.log
start "" /D "%STYLE_HOME%" "%STYLE_HOME%\Duna.exe"
"@
Set-Content -Path (Join-Path $TestRoot "IniciarStyle.bat") -Value $bat -Encoding ASCII

Write-Host "  OK v2 PRGs en $testProgs" -ForegroundColor Green

$ensureCtrl = Join-Path $testProgs "_ensure_control.prg"
@"
SET DEFAULT TO $TestRoot
SET PROCEDURE TO PROGS\suite_control_sync.prg ADDITIVE
DO SuiteEnsureControlSincro
"@ | Set-Content -Path $ensureCtrl -Encoding ASCII
Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$env:SUITE_VFP_HEADLESS = "1"
try {
    $proc = Start-Process -FilePath $VfpExe -ArgumentList "`"$ensureCtrl`"" -WorkingDirectory $TestRoot -PassThru -WindowStyle Hidden
    $null = $proc.WaitForExit(60000)
} finally {
    Remove-Item Env:\SUITE_VFP_HEADLESS -ErrorAction SilentlyContinue
}
Remove-Item $ensureCtrl -Force -ErrorAction SilentlyContinue
if (Test-Path (Join-Path $TestRoot "control_sincro.dbf")) {
    Write-Host "  OK control_sincro.dbf modo_activo=2" -ForegroundColor Green
}

if ($DeployVm) {
    $vmRoot = "\\$VmHost\c$\Style-Dunasoft"
    if (-not (Test-Path $vmRoot)) { throw "Sin acceso SMB a $vmRoot" }
    Write-Step "Copiar v2 fallback a VM"
    foreach ($f in $v2Files) {
        $src = Join-Path $testProgs $f
        if (Test-Path $src) { Copy-Item $src (Join-Path $vmRoot "PROGS\$f") -Force }
    }
    foreach ($d in $syncDirs) {
        $p = Join-Path $vmRoot $d
        if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
    }
    Write-Host "  OK VM $vmRoot" -ForegroundColor Green
}

Write-Host ""
Write-Host "Siguiente: .\scripts\run-style-v2-boot-test.ps1" -ForegroundColor Yellow
