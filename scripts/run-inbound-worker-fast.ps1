# Bucle rápido (~10 s) del worker inbound VFP. Alternativa al Task Scheduler (min ~60 s).
# Uso: .\scripts\run-inbound-worker-fast.ps1
#      .\scripts\run-inbound-worker-fast.ps1 -IntervalSec 10 -StyleRoot C:\Duna\Style-Suite-Test
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [int]$IntervalSec = 10
)

$ErrorActionPreference = "Stop"
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))
$vbs = Join-Path $StyleRoot "run_inbound_worker_hidden.vbs"

if (-not (Test-Path $vbs)) {
    & (Join-Path $PSScriptRoot "install-style-inbound-scheduler.ps1") -StyleRoot $StyleRoot | Out-Null
}

Write-Host "Inbound worker rapido cada ${IntervalSec}s en $StyleRoot (Ctrl+C para parar)" -ForegroundColor Cyan
while ($true) {
    $pending = @(Get-ChildItem (Join-Path $StyleRoot "sync\inbound\*.json") -ErrorAction SilentlyContinue).Count
    if ($pending -gt 0) {
        Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbs`"" -WindowStyle Hidden -Wait
    }
    Start-Sleep -Seconds $IntervalSec
}
