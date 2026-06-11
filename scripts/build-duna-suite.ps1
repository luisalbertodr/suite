# Compila PRGs Suite (VFP) y prepara Duna.exe para ReFox Replace.
$ErrorActionPreference = "Stop"
$ExportRoot = "C:\Duna\Export"
$Progs = Join-Path $ExportRoot "PROGS"
$Vfp = "C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe"
$CompileBat = Join-Path $ExportRoot "CompilarSuiteSync.bat"
$SrcExe = Join-Path $ExportRoot "mscomctl.exe"
$OutExe = Join-Path $ExportRoot "Duna.exe"

if (-not (Test-Path $Vfp)) { throw "No se encuentra VFP9: $Vfp" }
if (-not (Test-Path $CompileBat)) { throw "No se encuentra: $CompileBat" }

Write-Host "=== 1/2 Compilar PRGs Suite ===" -ForegroundColor Cyan
& $CompileBat
if ($LASTEXITCODE -ne 0) { throw "Compilacion fallida (exit $LASTEXITCODE)" }

$fxp = Join-Path $Progs "suite_full_unlock.fxp"
$size = (Get-Item $fxp).Length
Write-Host "suite_full_unlock.fxp OK ($size bytes)" -ForegroundColor Green

Write-Host "=== 2/2 Preparar Duna.exe base ===" -ForegroundColor Cyan
Copy-Item $SrcExe $OutExe -Force
Write-Host "Copiado mscomctl.exe -> Duna.exe" -ForegroundColor Green

Write-Host @"

Siguiente paso MANUAL en ReFox XI+ (no hay CLI fiable):
  Abrir: $OutExe
  Replace component con los .prg de $Progs :
    - general
    - funciones
    - suite_full_unlock
  Guardar Duna.exe y copiar a C:\Style-Dunasoft\

Verificacion: Usuarios\_suite_sync.log debe mostrar INIT ok

"@ -ForegroundColor Yellow
