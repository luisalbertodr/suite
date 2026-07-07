# Copia el runtime minimo de VFP9 (vfp9.exe + DLLs) al Style de la VM.
# No instala el IDE completo: solo lo necesario para run_inbound_worker.bat headless.
#
# Uso (desde PC de desarrollo con VFP9 instalado):
#   .\scripts\deploy-vfp9-runtime-vm.ps1
#   .\scripts\deploy-vfp9-runtime-vm.ps1 -StyleRoot "\\192.168.99.16\c$\Style-Dunasoft"
#   .\scripts\deploy-vfp9-runtime-vm.ps1 -VfpRoot "C:\Program Files (x86)\Microsoft Visual FoxPro 9"
#
param(
    [string]$StyleRoot = "\\192.168.99.16\c$\Style-Dunasoft",
    [string]$VfpRoot = "",
    [switch]$SkipBat
)

$ErrorActionPreference = "Stop"

function Resolve-VfpRoot {
    param([string]$Explicit)
    if ($Explicit -and (Test-Path $Explicit)) {
        return (Resolve-Path $Explicit).Path
    }
    if ($env:VFP9_ROOT -and (Test-Path $env:VFP9_ROOT)) {
        return (Resolve-Path $env:VFP9_ROOT).Path
    }
    foreach ($c in @(
        "${env:ProgramFiles(x86)}\Microsoft Visual FoxPro 9",
        "${env:ProgramFiles}\Microsoft Visual FoxPro 9",
        "${env:ProgramFiles(x86)}\Microsoft Visual FoxPro\VFP9"
    )) {
        if (Test-Path (Join-Path $c "vfp9.exe")) { return (Resolve-Path $c).Path }
    }
    throw "No se encuentra vfp9.exe. Instala VFP9 en este PC o pasa -VfpRoot."
}

$vfp = Resolve-VfpRoot -Explicit $VfpRoot
$style = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))
$dest = Join-Path $style "runtime\vfp9"

if (-not (Test-Path $style)) {
    throw "StyleRoot no accesible: $style"
}

# vfp9.exe + DLLs de idioma/runtime; sin .app del IDE (builder, gallery, etc.)
$names = @(
    "vfp9.exe",
    "VFP9ENU.DLL", "VFP9ESP.DLL", "VFP9CHS.DLL", "VFP9CHT.DLL", "VFP9KOR.DLL",
    "vfp9r.dll", "vfp9t.dll", "vfp9resn.dll", "vfp9k.dll", "vfp9enu.dll", "vfp9esp.dll",
    "foxtools.fll",
    "msvcr71.dll", "msvcp71.dll", "gdiplus.dll",
    "european.mem", "foxfont.fon"
)

New-Item -ItemType Directory -Force -Path $dest | Out-Null
$copied = @()
$missing = @()

foreach ($name in $names) {
    $src = Join-Path $vfp $name
    if (-not (Test-Path $src)) {
        $alt = Get-ChildItem $vfp -Filter $name -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($alt) { $src = $alt.FullName }
    }
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $dest (Split-Path -Leaf $src)) -Force
        $copied += (Split-Path -Leaf $src)
    } else {
        $missing += $name
    }
}

if ($copied -notcontains "vfp9.exe") {
    throw "No se copio vfp9.exe — abortando."
}

Write-Host "OK runtime VFP9 -> $dest" -ForegroundColor Green
Write-Host "  Copiados: $($copied.Count) ficheros" -ForegroundColor Cyan
if ($missing.Count -gt 0) {
    Write-Host "  Omitidos (no en origen): $($missing -join ', ')" -ForegroundColor DarkGray
}

if (-not $SkipBat) {
    $bat = @"
@echo off
rem pushd mapea UNC a unidad temporal (cd /d falla con \\server\share)
pushd "%~dp0"
set "STYLE_HOME=%~dp0"
set SUITE_INBOUND_HEADLESS=1
set "VFP="
if exist "%STYLE_HOME%runtime\vfp9\vfp9.exe" set "VFP=%STYLE_HOME%runtime\vfp9\vfp9.exe"
if not defined VFP if exist "C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe" set "VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe"
if not defined VFP if exist "C:\Program Files\Microsoft Visual FoxPro 9\vfp9.exe" set "VFP=C:\Program Files\Microsoft Visual FoxPro 9\vfp9.exe"
if defined VFP9_HOME if exist "%VFP9_HOME%\vfp9.exe" set "VFP=%VFP9_HOME%\vfp9.exe"
if not defined VFP (
  echo ERROR: No se encuentra vfp9.exe
  echo Ejecuta en el PC de desarrollo: .\scripts\deploy-vfp9-runtime-vm.ps1
  popd
  exit /b 1
)
"%VFP%" "PROGS\_inbound_once.prg"
set EXITCODE=%ERRORLEVEL%
popd
exit /b %EXITCODE%
"@
    Set-Content -Path (Join-Path $style "run_inbound_worker.bat") -Value $bat -Encoding ASCII
    Write-Host "  OK run_inbound_worker.bat (busca runtime\vfp9 primero)" -ForegroundColor Green
}

Write-Host ""
Write-Host "En la VM:" -ForegroundColor Yellow
Write-Host "  cd C:\Style-Dunasoft"
Write-Host "  run_inbound_worker.bat"
Write-Host "  type sync\heartbeat.txt"
