# Despliegue runtime sync v2 en carpeta Style (test o VM).
# Uso:
#   .\scripts\deploy-style-sync-runtime.ps1
#   .\scripts\deploy-style-sync-runtime.ps1 -StyleRoot "C:\Duna\Style-Suite-Test"
#   .\scripts\deploy-style-sync-runtime.ps1 -StyleRoot "\\192.168.99.16\c$\Style-Dunasoft" -InstallTasks
#
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [string]$AgentDir = "",
    [switch]$InstallTasks
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Vfp = Join-Path $RepoRoot "vfp"
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))

Write-Host "=== deploy-style-sync-runtime ===" -ForegroundColor Cyan
Write-Host "Destino: $StyleRoot"

$copyRoot = @(
    "ensure-style-sync.ps1",
    "IniciarStyle.bat",
    "RecuperarSyncInbound.bat",
    "SuiteSyncAgent.cfg.example"
)
foreach ($f in $copyRoot) {
    $src = Join-Path $Vfp $f
    if (-not (Test-Path $src)) { throw "Falta $src" }
    $dest = Join-Path $StyleRoot $f
    if ($f -eq "SuiteSyncAgent.cfg.example") {
        $dest = Join-Path $StyleRoot "SuiteSyncAgent.cfg"
        if (-not (Test-Path $dest)) {
            Copy-Item $src $dest -Force
            Write-Host "  OK SuiteSyncAgent.cfg (nuevo)" -ForegroundColor Green
        } else {
            Write-Host "  -- SuiteSyncAgent.cfg ya existe" -ForegroundColor DarkGray
        }
        continue
    }
    Copy-Item $src $dest -Force
    Write-Host "  OK $f" -ForegroundColor Green
}

$progs = @(
    "suite_boot_sync.prg",
    "suite_shutdown_sync.prg",
    "suite_sync_pending_alert.prg",
    "suite_v2_startup.prg",
    "suite_cola_sync.prg",
    "suite_inbound_worker.prg",
    "suite_entity_sync.prg",
    "suite_entity_inbound.prg",
    "suite_apply_license_unlock.prg",
    "funciones.prg"
)
$progDest = Join-Path $StyleRoot "PROGS"
New-Item -ItemType Directory -Force -Path $progDest | Out-Null
foreach ($f in $progs) {
    $src = Join-Path $Vfp $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $progDest $f) -Force
        Write-Host "  OK PROGS\$f" -ForegroundColor Green
    }
}
Copy-Item (Join-Path $Vfp "suite_inbound_worker.prg") (Join-Path $progDest "suite_inbound_worker_sync.prg") -Force

$oncePrg = Join-Path $progDest "_inbound_once.prg"
$vfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"
@"
* Wrapper scheduler: cwd + SAFETY OFF + cierra VFP.
SET SAFETY OFF
SET ESCAPE OFF
_SCREEN.Visible = .F.
PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = "$StyleRoot\"
SET DEFAULT TO (pcSuiteStyleRoot)
SET PROCEDURE TO (pcSuiteStyleRoot + "PROGS\suite_inbound_worker_sync.prg") ADDITIVE
DO SuiteInboundWorkerRun
QUIT
"@ | Set-Content -Path $oncePrg -Encoding ASCII
Write-Host "  OK PROGS\_inbound_once.prg" -ForegroundColor Green
if (Test-Path $vfpExe) {
    $runner = Join-Path $StyleRoot "run_inbound_worker.bat"
    @"
@echo off
cd /d "$StyleRoot"
set STYLE_HOME=$StyleRoot
set SUITE_INBOUND_HEADLESS=1
"$vfpExe" "PROGS\_inbound_once.prg"
"@ | Set-Content -Path $runner -Encoding ASCII
    $vbs = Join-Path $StyleRoot "run_inbound_worker_hidden.vbs"
    @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$StyleRoot"
sh.Run Chr(34) & "$runner" & Chr(34), 0, True
"@ | Set-Content -Path $vbs -Encoding ASCII
}

if ($AgentDir) {
    $cfg = Join-Path $StyleRoot "SuiteSyncAgent.cfg"
    "AGENT_DIR=$([IO.Path]::GetFullPath($AgentDir))" | Set-Content $cfg -Encoding ASCII
    Write-Host "  OK SuiteSyncAgent.cfg AGENT_DIR" -ForegroundColor Green
}

if ($InstallTasks) {
    & (Join-Path $RepoRoot "scripts\install-style-inbound-scheduler.ps1") -StyleRoot $StyleRoot
    try {
        & (Join-Path $RepoRoot "scripts\install-style-sync-agent.ps1") -StyleRoot $StyleRoot -AgentDir $AgentDir
    } catch {
        Write-Warning "install-style-sync-agent: $_ (ejecutar PowerShell como administrador)"
    }
}

& (Join-Path $Vfp "ensure-style-sync.ps1") -StyleRoot $StyleRoot -EnsureAgent | Out-Null
Write-Host "Listo. Arranque: $StyleRoot\IniciarStyle.bat" -ForegroundColor Cyan
