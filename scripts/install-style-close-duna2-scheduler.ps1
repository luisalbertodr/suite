# Task Scheduler: cerrar Duna2.exe a las 01:00 cada dia (ventana sync hard).
#
# Uso:
#   .\scripts\install-style-close-duna2-scheduler.ps1
#   .\scripts\install-style-close-duna2-scheduler.ps1 -StyleRoot "C:\Style-Dunasoft"
#   .\scripts\install-style-close-duna2-scheduler.ps1 -VmHost "192.168.99.16"
#
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [string]$TaskName = "SuiteStyleCloseDuna2Nightly",
    [string]$DailyAt = "01:00",
    [string]$VmHost = "",
    [switch]$NoDrainInbound
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpScript = Join-Path $RepoRoot "vfp\close-duna2-nightly.ps1"
if (-not (Test-Path $VfpScript)) { throw "Falta $VfpScript" }

$VmLocalRoot = "C:\Style-Dunasoft"
if ($VmHost) {
    $StyleRoot = "\\$VmHost\c$\Style-Dunasoft"
    $TaskStyleRoot = $VmLocalRoot
} else {
    $TaskStyleRoot = $StyleRoot
}
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))
$TaskStyleRoot = $TaskStyleRoot.TrimEnd('\')

$destScript = Join-Path $StyleRoot "close-duna2-nightly.ps1"
Copy-Item $VfpScript $destScript -Force
Write-Host "  OK close-duna2-nightly.ps1 -> $destScript" -ForegroundColor Green

$drainArg = if ($NoDrainInbound) { "" } else { " -DrainInbound" }
$taskScript = Join-Path $TaskStyleRoot "close-duna2-nightly.ps1"
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$taskScript`" -StyleRoot `"$TaskStyleRoot`"$drainArg"

$registered = $false
try {
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $psArgs -WorkingDirectory $TaskStyleRoot
    $trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
        -Hidden

    if ($VmHost) {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
            -User "SYSTEM" -RunLevel Highest -Force -CimSession (New-CimSession -ComputerName $VmHost) | Out-Null
    } else {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
            -User "SYSTEM" -RunLevel Highest -Force | Out-Null
    }
    $registered = $true
    Write-Host "OK Task $TaskName diaria a las $DailyAt (SYSTEM, todas las sesiones)" -ForegroundColor Green
} catch {
    Write-Warning "Register-ScheduledTask: $($_.Exception.Message)"
}

if (-not $registered) {
    $tr = "powershell.exe $psArgs"
    if ($VmHost) {
        schtasks /Delete /S $VmHost /TN $TaskName /F 2>$null | Out-Null
        $code = schtasks /Create /S $VmHost /TN $TaskName /TR $tr /SC DAILY /ST $DailyAt /RU SYSTEM /RL HIGHEST /F 2>&1
    } else {
        schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
        $code = schtasks /Create /TN $TaskName /TR $tr /SC DAILY /ST $DailyAt /RU SYSTEM /RL HIGHEST /F 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK Task $TaskName (schtasks diaria $DailyAt)" -ForegroundColor Green
    } else {
        throw "No se pudo registrar $TaskName. Ejecuta PowerShell como administrador. Detalle: $code"
    }
}
