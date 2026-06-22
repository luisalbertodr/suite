# Arranque corto de Style test y validación de log v2 ([BOOT-04] o [BOOT-06] + SuiteEnqueue).
param(
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [int]$WaitSec = 25
)

$ErrorActionPreference = "Stop"
$TestRoot = [IO.Path]::GetFullPath($TestRoot.TrimEnd('\'))
$duna = Join-Path $TestRoot "Duna.exe"
$log = Join-Path $TestRoot "Usuarios\_suite_sync.log"

if (-not (Test-Path $duna)) {
    throw "Falta $duna — ejecuta setup-style-v2-test-fallback.ps1"
}

Get-Process -Name Duna -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

if (Test-Path $log) { Remove-Item $log -Force -ErrorAction SilentlyContinue }

Write-Host "Arrancando Duna.exe ($WaitSec s)..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $duna -WorkingDirectory $TestRoot -PassThru
Start-Sleep -Seconds $WaitSec
if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

$fail = 0
function Test-Line([bool]$Ok, [string]$Msg) {
    if ($Ok) { Write-Host "  OK $Msg" -ForegroundColor Green }
    else { Write-Host "  FAIL $Msg" -ForegroundColor Red; $script:fail++ }
}

Write-Host ""
Write-Host "=== run-style-v2-boot-test ===" -ForegroundColor Cyan
$fi = Get-Item $duna
Test-Line ($fi.Length -ge 28MB -and $fi.Length -le 34MB) ("Duna.exe {0:N0} bytes" -f $fi.Length)

if (-not (Test-Path $log)) {
    Test-Line $false "Sin log $log"
} else {
    $content = Get-Content $log -Raw -ErrorAction SilentlyContinue
    Test-Line ($content -match '\[BOOT-04\]|\[BOOT-06\]|\[INIT-03\]') "Log contiene v2 cargada (BOOT-04/06 o INIT-03)"
    Test-Line ($content -notmatch '\[BOOT-07\]') "Sin BOOT-07 (sync cargada)"
    Test-Line ($content -notmatch 'suite_full_unlock') "Log sin suite_full_unlock"
    Test-Line ($content -notmatch '1732|nombre de clase') "Sin error 1732"
}

if ($fail -eq 0) {
    Write-Host ""
    Write-Host "Boot test OK" -ForegroundColor Green
    exit 0
}
Write-Host ""
Write-Host "Boot test con $fail fallo(s)" -ForegroundColor Red
exit 1
