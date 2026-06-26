# Task Scheduler: ejecutar suite_inbound_worker.prg cada N s (oculto, sin dialogos SAFETY).
#
# Uso:
#   .\scripts\install-style-inbound-scheduler.ps1
#   .\scripts\install-style-inbound-scheduler.ps1 -IntervalSec 60
#   .\scripts\install-style-inbound-scheduler.ps1 -StyleRoot "\\192.168.99.16\c$\Style-Dunasoft" -VmHost "192.168.99.16"
#
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [string]$TaskName = "SuiteStyleInboundWorker",
    [int]$IntervalSec = 60,
    [string]$VmHost = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"

if ($VmHost) {
    $StyleRoot = "\\$VmHost\c$\Style-Dunasoft"
}
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))

if (-not (Test-Path $VfpExe)) { throw "VFP9 no instalado" }
if ($IntervalSec -lt 60) {
    Write-Warning "Task Scheduler minimo ~60s; usando IntervalSec=60"
    $IntervalSec = 60
}

$worker = Join-Path $StyleRoot "PROGS\suite_inbound_worker_sync.prg"
if (-not (Test-Path $worker)) {
    Copy-Item (Join-Path $RepoRoot "vfp\suite_inbound_worker.prg") $worker -Force
} else {
    Copy-Item (Join-Path $RepoRoot "vfp\suite_inbound_worker.prg") $worker -Force
}

$oncePrg = Join-Path $StyleRoot "PROGS\_inbound_once.prg"
$once = @"
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
"@
Set-Content -Path $oncePrg -Value $once -Encoding ASCII

$runner = Join-Path $StyleRoot "run_inbound_worker.bat"
$bat = @"
@echo off
cd /d "$StyleRoot"
set STYLE_HOME=$StyleRoot
set SUITE_INBOUND_HEADLESS=1
"$VfpExe" "PROGS\_inbound_once.prg"
"@
Set-Content -Path $runner -Value $bat -Encoding ASCII

$vbs = Join-Path $StyleRoot "run_inbound_worker_hidden.vbs"
$vbsContent = @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$StyleRoot"
sh.Run Chr(34) & "$runner" & Chr(34), 0, True
"@
Set-Content -Path $vbs -Value $vbsContent -Encoding ASCII

$intervalMin = [Math]::Max(1, [int][Math]::Ceiling($IntervalSec / 60.0))
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $StyleRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $intervalMin) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -Hidden

if ($VmHost) {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -User "SYSTEM" -RunLevel Highest -Force -CimSession (New-CimSession -ComputerName $VmHost)
    Write-Host "OK Task $TaskName en VM $VmHost cada ~$($intervalMin) min (oculto)" -ForegroundColor Green
} else {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force
    Write-Host "OK Task $TaskName local cada ~$($intervalMin) min (oculto, sin ventana CMD/VFP)" -ForegroundColor Green
}
