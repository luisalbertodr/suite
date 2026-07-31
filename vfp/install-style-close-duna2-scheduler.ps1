# Task Scheduler: cerrar Duna2.exe a las 01:00 y lanzar hard sync.
# Copiar a la raíz Style (C:\Style-Dunasoft) junto a close-duna2-nightly.ps1
#
# Uso (desde C:\Style-Dunasoft, PowerShell como administrador):
#   .\install-style-close-duna2-scheduler.ps1
#   cd C:\Style-Dunasoft; .\install-style-close-duna2-scheduler.ps1
#
# Desde el repo en la misma VM:
#   .\scripts\install-style-close-duna2-scheduler.ps1
#   .\scripts\install-style-close-duna2-scheduler.ps1 -StyleRoot "C:\Style-Dunasoft"
#
param(
    [string]$StyleRoot = "",
    [string]$TaskName = "SuiteStyleCloseDuna2Nightly",
    [string]$DailyAt = "01:00",
    [switch]$NoDrainInbound,
    [switch]$NoHardSync
)

$ErrorActionPreference = "Stop"

if (-not $StyleRoot) {
    $StyleRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
}
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))

$nightlyScript = Join-Path $StyleRoot "close-duna2-nightly.ps1"
if (-not (Test-Path $nightlyScript)) {
    throw "Falta $nightlyScript en $StyleRoot. Ejecuta deploy-style-sync-runtime.ps1 o copia close-duna2-nightly.ps1."
}

$drainArg = if ($NoDrainInbound) { "" } else { " -DrainInbound" }
$hardArg = if ($NoHardSync) { "" } else { " -TriggerHardSync" }
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$nightlyScript`" -StyleRoot `"$StyleRoot`"$drainArg$hardArg"

$registered = $false
try {
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $psArgs -WorkingDirectory $StyleRoot
    $trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 45) `
        -Hidden

    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -User "SYSTEM" -RunLevel Highest -Force | Out-Null
    $registered = $true
    Write-Host "OK Task $TaskName diaria a las $DailyAt (SYSTEM)" -ForegroundColor Green
} catch {
    Write-Warning "Register-ScheduledTask: $($_.Exception.Message)"
}

if (-not $registered) {
    $tr = "powershell.exe $psArgs"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
    $null = schtasks /Create /TN $TaskName /TR $tr /SC DAILY /ST $DailyAt /RU SYSTEM /RL HIGHEST /F 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($code -eq 0) {
        Write-Host "OK Task $TaskName (schtasks diaria $DailyAt)" -ForegroundColor Green
    } else {
        throw "No se pudo registrar $TaskName. Ejecuta PowerShell como administrador."
    }
}

Write-Host "Script nocturno: $nightlyScript" -ForegroundColor Cyan
Write-Host "Log: $StyleRoot\sync\close_duna2_nightly.log" -ForegroundColor Cyan
