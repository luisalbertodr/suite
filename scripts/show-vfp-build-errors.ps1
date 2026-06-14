# Muestra build_mscomctl.log y todos los .ERR de C:\Duna\Export tras un build VFP9.
param([string]$ExportRoot = "C:\Duna\Export")

$progs = Join-Path $ExportRoot "PROGS"
$log = Join-Path $ExportRoot "build_mscomctl.log"

Write-Host "=== build_mscomctl.log ===" -ForegroundColor Cyan
if (Test-Path $log) { Get-Content $log } else { Write-Host "(no existe)" -ForegroundColor Yellow }

Write-Host "`n=== *.ERR ===" -ForegroundColor Cyan
$errFiles = @(
    (Join-Path $ExportRoot "mscomctl.ERR")
) + (Get-ChildItem $progs -Filter "*.ERR" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })

if (-not $errFiles) { Write-Host "(ninguno)" -ForegroundColor Green; exit 0 }

foreach ($f in $errFiles) {
    if (-not (Test-Path $f)) { continue }
    $size = (Get-Item $f).Length
    if ($size -le 0) { continue }
    Write-Host "`n--- $f ($size bytes) ---" -ForegroundColor Yellow
    Get-Content $f
}
