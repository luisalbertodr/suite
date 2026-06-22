# Detiene el worker inbound que lanza VFP9 cada minuto (util durante build manual en IDE).
param(
    [string]$TaskName = "SuiteStyleInboundWorker"
)

$ErrorActionPreference = "SilentlyContinue"
Disable-ScheduledTask -TaskName $TaskName
Stop-ScheduledTask -TaskName $TaskName
Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "OK Tarea $TaskName deshabilitada. VFP9 cerrado." -ForegroundColor Green
Write-Host "Reactivar tras el build: .\scripts\install-style-inbound-scheduler.ps1" -ForegroundColor Yellow
