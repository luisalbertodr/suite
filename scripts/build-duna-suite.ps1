# Build Duna.exe con VFP9 (sin ReFox). Canonico: C:\Duna\Export\BUILD-DUNA.bat
$ErrorActionPreference = "Stop"
$ExportRoot = "C:\Duna\Export"
$BuildBat = Join-Path $ExportRoot "BUILD-DUNA.bat"

if (-not (Test-Path $BuildBat)) { throw "No existe $BuildBat" }

Write-Host "=== build-duna-suite (VFP9) ===" -ForegroundColor Cyan
& $BuildBat
if ($LASTEXITCODE -ne 0) { throw "BUILD-DUNA.bat fallo (exit $LASTEXITCODE)" }

$duna = Join-Path $ExportRoot "Duna.exe"
if (-not (Test-Path $duna)) { throw "No se genero $duna" }
$fi = Get-Item $duna
Write-Host ("OK Duna.exe  {0} bytes  {1}" -f $fi.Length, $fi.LastWriteTime) -ForegroundColor Green
Write-Host "Copiar a VM: .\scripts\deploy-duna-exe-vm.ps1" -ForegroundColor Yellow
