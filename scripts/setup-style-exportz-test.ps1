# Monta entorno de prueba para build ExportZ (exe embebido, sin PROGS/FXP externos).
#
# Uso:
#   .\scripts\setup-style-exportz-test.ps1
#   .\scripts\setup-style-exportz-test.ps1 -DestRoot 'C:\Duna\Style-Suite-Test'
#
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$DestRoot = "C:\Duna\Style-Suite-Test",
    [string]$SourceRoot = "Z:\Style-Dunasoft",
    [switch]$SkipEmpresaCopy,
    [switch]$KeepProgsFallback
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"

$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$DestRoot = [IO.Path]::GetFullPath($DestRoot.TrimEnd('\'))

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "=== $Msg ===" -ForegroundColor Cyan
}

function Move-ToQuarantine {
    param([string]$Path, [string]$QuarantineDir)
    if (-not (Test-Path $Path)) { return }
    if (-not (Test-Path $QuarantineDir)) {
        New-Item -ItemType Directory -Path $QuarantineDir -Force | Out-Null
    }
    $name = Split-Path $Path -Leaf
    $dst = Join-Path $QuarantineDir $name
    if (Test-Path $dst) { Remove-Item $dst -Force }
    Move-Item $Path $dst -Force
    Write-Host "  cuarentena: $name" -ForegroundColor Yellow
}

Write-Step "setup-style-exportz-test"
Write-Host "ExportZ: $ExportRoot"
Write-Host "Destino: $DestRoot"

if (-not (Test-Path $DestRoot)) {
    New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null
}

$duna = Join-Path $DestRoot "Duna.exe"
if (-not (Test-Path $duna)) {
    throw "Falta $duna — ejecuta build-style-exportz.ps1 -AfterBuild -DeployTest primero"
}

$quarantine = Join-Path $DestRoot ("_suite_quarantine\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $quarantine -Force | Out-Null

Write-Step "vcx desde ExportZ"
$vcxSrc = Join-Path $ExportRoot "vcx"
$vcxDst = Join-Path $DestRoot "vcx"
if (Test-Path $vcxSrc) {
    if (-not (Test-Path $vcxDst)) { New-Item -ItemType Directory -Path $vcxDst -Force | Out-Null }
    Copy-Item (Join-Path $vcxSrc "*") $vcxDst -Recurse -Force
    $cnt = (Get-ChildItem $vcxDst -File).Count
    Write-Host "  OK $cnt archivos en vcx\" -ForegroundColor Green
} else {
    Write-Host "  AVISO: sin vcx en ExportZ" -ForegroundColor Yellow
}

Write-Step "PROGS (exe embebido)"
$destProgs = Join-Path $DestRoot "PROGS"
if (-not (Test-Path $destProgs)) {
    New-Item -ItemType Directory -Path $destProgs -Force | Out-Null
}
Get-ChildItem $destProgs -File | ForEach-Object {
    Move-ToQuarantine -Path $_.FullName -QuarantineDir (Join-Path $quarantine "progs_old")
}
if ($KeepProgsFallback) {
    Copy-Item (Join-Path $VfpRepo "suite_full_unlock.prg") (Join-Path $destProgs "suite_full_unlock.prg") -Force
    Write-Host "  fallback: suite_full_unlock.prg" -ForegroundColor DarkGray
} else {
    Write-Host "  PROGS vaciado (sync embebida en exe)" -ForegroundColor Green
}

Write-Step "Scripts de arranque"
Copy-Item (Join-Path $RepoRoot "scripts\ensure-style-dbc.ps1") (Join-Path $DestRoot "ensure-style-dbc.ps1") -Force

$bat = @"
@echo off
setlocal
set "STYLE_HOME=%~dp0"
cd /d "%STYLE_HOME%"
set "STYLE_HOME=%CD%"

if exist "%~dp0ensure-style-dbc.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-style-dbc.ps1" -StyleRoot "%CD%" -RemoveWedbRootOnly 2>nul
)

if not exist "%CD%\Duna.exe" (
  echo ERROR: falta Duna.exe — build-style-exportz.ps1 -AfterBuild -DeployTest
  pause & exit /b 1
)
if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg
  pause & exit /b 1
)
if not exist Usuarios mkdir Usuarios 2>nul

if exist "%CD%\PROGS\suite_full_unlock.fxp" ren "%CD%\PROGS\suite_full_unlock.fxp" suite_full_unlock.fxp.bak >nul 2>&1
if exist "%CD%\PROGS\suite_full_unlock.FXP" ren "%CD%\PROGS\suite_full_unlock.FXP" suite_full_unlock.fxp.bak >nul 2>&1
if exist "%CD%\PROGS\funciones.fxp" ren "%CD%\PROGS\funciones.fxp" funciones.fxp.bak >nul 2>&1
if exist "%CD%\PROGS\general.fxp" ren "%CD%\PROGS\general.fxp" general.fxp.bak >nul 2>&1

echo Style ExportZ test: %CD%
echo Log: Usuarios\_suite_sync.log
echo.

start "" /D "%STYLE_HOME%" "%STYLE_HOME%Duna.exe"
"@
Set-Content -Path (Join-Path $DestRoot "IniciarStyle.bat") -Value $bat -Encoding ASCII

@"
* VFP: directorio de trabajo = raiz Style
DEFAULT=$DestRoot
RESOURCE=OFF
MVCOUNT=4096
"@ | Set-Content (Join-Path $DestRoot "config.fpw") -Encoding ASCII

$cfgDest = Join-Path $DestRoot "SuiteSync.cfg"
if (-not (Test-Path $cfgDest)) {
    $example = Join-Path $VfpRepo "SuiteSync.cfg.example"
    if (Test-Path $example) {
        $content = Get-Content $example -Raw
        $content = $content -replace 'SYNC_MAC=STYLE-VM', 'SYNC_MAC=STYLE-PORTABLE-DEV'
        $content = $content -replace 'SYNC_INTERVAL=30', 'SYNC_INTERVAL=10'
        Set-Content $cfgDest $content -Encoding ASCII
        Write-Host "  OK SuiteSync.cfg (revisa SYNC_TOKEN)" -ForegroundColor Yellow
    }
}

if (-not $SkipEmpresaCopy -and (Test-Path $SourceRoot)) {
    Write-Step "Config empresa desde Z"
    & (Join-Path $RepoRoot "scripts\sync-style-config-from-z.ps1") -SourceRoot $SourceRoot -DestRoot $DestRoot
}

$fi = Get-Item $duna
$leeme = @"
Style-Suite-Test — build ExportZ (decompile Z)
==============================================
Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

Duna.exe: $($fi.Length) bytes $($fi.LastWriteTime)
Origen build: $ExportRoot

Reglas:
  - PROGS vacio (sync embebida en exe)
  - Nunca suite_full_unlock.fxp en PROGS
  - vcx copiado desde ExportZ

Log: Usuarios\_suite_sync.log
Esperado: [BOOT-04] [INIT-03]

Cuarentena: $quarantine
"@
Set-Content (Join-Path $DestRoot "LEEME-ARRANQUE.txt") $leeme -Encoding UTF8

Write-Step "Listo"
Write-Host "Arranque: $DestRoot\IniciarStyle.bat" -ForegroundColor Cyan
