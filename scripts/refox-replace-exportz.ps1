# Prepara ReFox Replace en Duna.exe ExportZ (v2 sync cola, sin BUILD PROJECT).
#
# Uso:
#   .\scripts\refox-replace-exportz.ps1
#   .\scripts\refox-replace-exportz.ps1 -DeployTest
#
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [string]$BaseExe = "",
    [switch]$DeployTest,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$Progs = Join-Path $ExportRoot "PROGS"
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"

function Write-Step([string]$Msg) {
    if (-not $Quiet) { Write-Host ""; Write-Host "=== $Msg ===" -ForegroundColor Cyan }
}
function Write-Ok([string]$Msg) { if (-not $Quiet) { Write-Host "  OK $Msg" -ForegroundColor Green } }

if (-not (Test-Path $VfpExe)) { throw "VFP9 no instalado" }

Write-Step "refox-replace-exportz"
& (Join-Path $RepoRoot "scripts\build-style-exportz.ps1") -SkipRepair -Quiet:$Quiet

$compile = Join-Path $Progs "VfpCompileSuitePrgs.prg"
Copy-Item (Join-Path $VfpRepo "VfpCompileSuitePrgs.prg") $compile -Force
Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$env:SUITE_VFP_HEADLESS = "1"
try {
    $proc = Start-Process -FilePath $VfpExe -ArgumentList "`"$compile`"" -WorkingDirectory $ExportRoot -PassThru -WindowStyle Hidden
    $null = $proc.WaitForExit(300000)
} finally {
    Remove-Item Env:\SUITE_VFP_HEADLESS -ErrorAction SilentlyContinue
}
Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force

foreach ($base in @("general", "funciones", "suite_cola_sync", "suite_control_sync")) {
    $err = Join-Path $Progs "$base.ERR"
    if (Test-Path $err) { throw "Error compilando $base — ver $err" }
    if (-not (Test-Path (Join-Path $Progs "$base.prg"))) { throw "Falta PROGS\$base.prg" }
    Write-Ok "$base.prg sin .ERR"
}

if ([string]::IsNullOrWhiteSpace($BaseExe)) {
    $candidates = @(
        "Z:\Style-Dunasoft\Duna.exe",
        "Z:\Style-Dunasoft\mscomctl.exe",
        (Join-Path $ExportRoot "duna.exe"),
        (Join-Path $ExportRoot "mscomctlok.exe")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $BaseExe = $c; break }
    }
}
if (-not (Test-Path $BaseExe)) {
    throw "No hay exe base. Pasa -BaseExe o monta Z:\Style-Dunasoft"
}

$duna = Join-Path $ExportRoot "Duna.exe"
Copy-Item $BaseExe $duna -Force
Write-Ok ("Duna.exe base {0:N0} bytes <- {1}" -f (Get-Item $duna).Length, $BaseExe)

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host " ReFox XI+ (manual, ~2 min)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host @"

  1. Abre ReFox XI+ (Targ_Dir ya apunta a $ExportRoot)
  2. File > Open > $duna
  3. Replace component:
       general           <- $Progs\general.prg
       funciones         <- $Progs\funciones.prg
       suite_cola_sync   <- $Progs\suite_cola_sync.prg
       suite_control_sync <- $Progs\suite_control_sync.prg
  4. Guardar Duna.exe

  Luego:
    .\scripts\build-style-exportz.ps1 -AfterBuild -DeployTest

"@ -ForegroundColor White

if ($DeployTest -and (Test-Path $duna)) {
    Write-Step "Copiar a test (pre-ReFox; re-ejecuta tras Replace)"
    if (-not (Test-Path $TestRoot)) { New-Item -ItemType Directory -Path $TestRoot -Force | Out-Null }
    Copy-Item $duna (Join-Path $TestRoot "Duna.exe") -Force
    & (Join-Path $RepoRoot "scripts\setup-style-exportz-test.ps1") -DestRoot $TestRoot
}
