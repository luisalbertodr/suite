# Task Scheduler: ejecutar suite_inbound_worker.prg cada 45 s (local o VM remota).
#
# Uso:
#   .\scripts\install-style-inbound-scheduler.ps1
#   .\scripts\install-style-inbound-scheduler.ps1 -StyleRoot "\\192.168.99.16\c$\Style-Dunasoft"

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
$worker = Join-Path $StyleRoot "PROGS\suite_inbound_worker.prg"
if (-not (Test-Path $worker)) {
    Copy-Item (Join-Path $RepoRoot "vfp\suite_inbound_worker.prg") $worker -Force
}

$runner = Join-Path $StyleRoot "run_inbound_worker.bat"
$bat = @"
@echo off
cd /d "$StyleRoot"
"$VfpExe" "$worker"
"@
Set-Content -Path $runner -Value $bat -Encoding ASCII

$action = New-ScheduledTaskAction -Execute $runner -WorkingDirectory $StyleRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

if ($VmHost) {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -User "SYSTEM" -RunLevel Highest -Force -CimSession (New-CimSession -ComputerName $VmHost)
    Write-Host "OK Task $TaskName en VM $VmHost cada ${IntervalSec}s" -ForegroundColor Green
} else {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force
    Write-Host "OK Task $TaskName local cada ${IntervalSec}s" -ForegroundColor Green
}
