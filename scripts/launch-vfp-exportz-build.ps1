# Abre VFP9 IDE en ExportZ con instrucciones para BUILD EXE nativo (no ReFox).
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$ProjectName = "mscomctlOk"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"

if (-not (Test-Path $VfpExe)) { throw "VFP9 no instalado: $VfpExe" }

& (Join-Path $RepoRoot "scripts\build-style-exportz.ps1") -SkipRepair -SkipCompile -Quiet

Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "=== Abriendo VFP9 en $ExportRoot ===" -ForegroundColor Cyan
Write-Host @"

1. Si memo .pjt invalido:
     DO PROGS\RepairExportzFromLfn.prg   (tras New/Open Project)
     File > Save

2. Compilar PRGs + exe:
     SET DEFAULT TO $ExportRoot
     DO PROGS\VfpCompilePrgs.prg
     DO PROGS\VfpBuildProject.prg
   O: BUILD EXE Duna.exe FROM $ProjectName RECOMPILE

3. Post-build:
     .\scripts\build-style-exportz.ps1 -AfterBuild -DeployTest
     .\scripts\validate-style-exportz-build.ps1

"@ -ForegroundColor White

Start-Process -FilePath $VfpExe -WorkingDirectory $ExportRoot
