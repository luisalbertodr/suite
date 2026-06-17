# Prepara el portable Style-Dunasoft para pruebas de sync Suite en este PC.
#
# Uso:
#   cd C:\Users\OportoW11\Suite\suite
#   .\scripts\setup-portable-sync-test.ps1
#   .\scripts\setup-portable-sync-test.ps1 -PortableRoot 'D:\Style-Dunasoft'

param(
    [string]$PortableRoot = "",
    [string]$StyleSource = "",
    [string]$DunaExe = "",
    [string]$SyncMac = "STYLE-PORTABLE-DEV",
    [int]$SyncInterval = 10,
    [switch]$LocalDunaOnly
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $PortableRoot) {
    $PortableRoot = Join-Path $RepoRoot "dist\style-portable\Style-Dunasoft-PC-Limpio"
}
$PortableRoot = [System.IO.Path]::GetFullPath($PortableRoot)

if (-not (Test-Path $PortableRoot)) {
    throw "No existe portable: $PortableRoot"
}

if (-not $StyleSource) {
    $styleCandidates = @(
        "C:\Duna\260603-Style-Dunasoft",
        "C:\Duna\Style-Suite-Test",
        "Z:\Style-Dunasoft"
    )
    foreach ($c in $styleCandidates) {
        $pExe = Join-Path $c "Duna.exe"
        $pDbf = Join-Path $c "dbf"
        if ((Test-Path $pExe) -or (Test-Path $pDbf)) {
            $StyleSource = $c
            break
        }
    }
    if (-not $StyleSource) { $StyleSource = "Z:\Style-Dunasoft" }
}

if ($LocalDunaOnly -or $PortableRoot -like "C:\Duna\*") {
    $LocalDunaOnly = $true
}

if (-not $DunaExe) {
    foreach ($c in @("C:\Duna\Export\Duna2.exe", "C:\Duna\Export\Duna.exe")) {
        if (Test-Path $c) { $DunaExe = $c; break }
    }
}

if (-not $LocalDunaOnly -and -not (Test-Path (Join-Path $StyleSource "Duna.exe"))) {
    if (Test-Path (Join-Path $PortableRoot "Duna.exe")) {
        Write-Host "AVISO: fuente sin Duna.exe — reutilizando el del portable" -ForegroundColor Yellow
        $StyleSource = $PortableRoot
    } else {
        throw "No accesible Style fuente: $StyleSource (ni Duna.exe en portable)"
    }
}

Write-Host "=== setup-portable-sync-test ===" -ForegroundColor Cyan
Write-Host "Portable: $PortableRoot"
Write-Host "Fuente:   $StyleSource"

# Duna.exe: en C:\Duna usar build local (no Z: produccion)
if ($LocalDunaOnly -and $DunaExe -and (Test-Path $DunaExe)) {
    Copy-Item $DunaExe (Join-Path $PortableRoot "Duna.exe") -Force
    Write-Host "Duna.exe desde $DunaExe (local, sin Z:)" -ForegroundColor Green
} elseif (Test-Path (Join-Path $StyleSource "Duna.exe")) {
    Copy-Item (Join-Path $StyleSource "Duna.exe") (Join-Path $PortableRoot "Duna.exe") -Force
    Write-Host "Duna.exe desde $StyleSource" -ForegroundColor Green
} elseif (Test-Path (Join-Path $PortableRoot "Duna.exe")) {
    Write-Host "AVISO: sin fuente Duna.exe — se mantiene el del portable" -ForegroundColor Yellow
} else {
    throw "Falta Duna.exe"
}

# VCX completos (Export tiene ~40; VM solo 4 — insuficiente si el exe los referencia)
$exportVcx = "C:\Duna\Export\vcx"
if (Test-Path $exportVcx) {
    $vcxDst = Join-Path $PortableRoot "vcx"
    New-Item -ItemType Directory -Path $vcxDst -Force | Out-Null
    robocopy $exportVcx $vcxDst /E /NFL /NDL /NJH /NJS | Out-Null
    Write-Host "vcx desde $exportVcx" -ForegroundColor Green
} elseif (Test-Path (Join-Path $StyleSource "vcx")) {
    $vcxDst = Join-Path $PortableRoot "vcx"
    New-Item -ItemType Directory -Path $vcxDst -Force | Out-Null
    robocopy (Join-Path $StyleSource "vcx") $vcxDst /E /NFL /NDL /NJH /NJS | Out-Null
}

# PROGS sync (fallback si unlock no embebido)
$progsDst = Join-Path $PortableRoot "PROGS"
New-Item -ItemType Directory -Path $progsDst -Force | Out-Null
$progsSources = @()
if (Test-Path "C:\Duna\Export260613\PROGS") { $progsSources += "C:\Duna\Export260613\PROGS" }
if (Test-Path (Join-Path $StyleSource "PROGS")) { $progsSources += (Join-Path $StyleSource "PROGS") }
foreach ($name in @(
    "suite_full_unlock.fxp", "suite_full_unlock.prg",
    "funciones.fxp", "funciones.prg",
    "general.fxp", "general.prg"
)) {
    foreach ($progsSrc in $progsSources) {
        $src = Join-Path $progsSrc $name
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $progsDst $name) -Force
            Write-Host "PROGS\$name <- $progsSrc" -ForegroundColor Green
            break
        }
    }
}
# Raiz: fallback activar_suite_sync
Copy-Item (Join-Path $RepoRoot "vfp\suite_full_unlock.prg") (Join-Path $PortableRoot "suite_full_unlock.prg") -Force
Copy-Item (Join-Path $RepoRoot "vfp\activar_suite_sync.prg") (Join-Path $PortableRoot "activar_suite_sync.prg") -Force
Copy-Item (Join-Path $RepoRoot "vfp\autosuite_sync.prg") (Join-Path $PortableRoot "autosuite_sync.prg") -Force

# CONFIG.FPW: arranque automatico sync sin Ctrl+F5 manual
@"
STARTUP=autosuite_sync
RESOURCE=OFF
CODEPAGE=1252
"@ | Set-Content (Join-Path $PortableRoot "CONFIG.FPW") -Encoding ASCII

$hasStyleCfg = Test-Path (Join-Path $StyleSource "SuiteSync.cfg")
if ($hasStyleCfg -and (-not $LocalDunaOnly)) {
    Copy-Item (Join-Path $StyleSource "SuiteSync.cfg") (Join-Path $PortableRoot "SuiteSync.cfg") -Force
} elseif (-not (Test-Path (Join-Path $PortableRoot "SuiteSync.cfg"))) {
    $cfgExample = Join-Path $RepoRoot "vfp\SuiteSync.cfg.example"
    if (Test-Path $cfgExample) {
        Copy-Item $cfgExample (Join-Path $PortableRoot "SuiteSync.cfg") -Force
        Write-Host "AVISO: SuiteSync.cfg desde ejemplo — revisa SYNC_TOKEN" -ForegroundColor Yellow
    }
}

# Scripts de diagnostico en portable
foreach ($script in @("TestStyleSync.ps1", "DiagnosticarSuiteSync.ps1")) {
    Copy-Item (Join-Path $RepoRoot "vfp" $script) (Join-Path $PortableRoot $script) -Force
}

# Ajustar SuiteSync.cfg (MAC unico para portable)
$cfgPath = Join-Path $PortableRoot "SuiteSync.cfg"
$cfgLines = Get-Content $cfgPath
$newLines = foreach ($line in $cfgLines) {
    if ($line -match '^\s*SYNC_MAC\s*=') { "SYNC_MAC=$SyncMac" }
    elseif ($line -match '^\s*SYNC_INTERVAL\s*=') { "SYNC_INTERVAL=$SyncInterval" }
    else { $line }
}
Set-Content -Path $cfgPath -Value $newLines -Encoding ASCII

# Copia en dbf\ por si SET DEFAULT apunta a dbf\ (arranque legacy)
Copy-Item $cfgPath (Join-Path $PortableRoot "dbf\SuiteSync.cfg") -Force

# wedb raiz limpio
$dbcScript = Join-Path $RepoRoot "scripts\ensure-style-dbc.ps1"
if (Test-Path $dbcScript) {
    & $dbcScript -StyleRoot $PortableRoot -RemoveWedbRootOnly
}

New-Item -ItemType Directory -Path (Join-Path $PortableRoot "Usuarios") -Force | Out-Null

# Launcher
$bat = @'
@echo off
setlocal
set "STYLE_HOME=%~dp0"
cd /d "%STYLE_HOME%"

if exist "%~dp0ensure-style-dbc.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-style-dbc.ps1" -StyleRoot "%CD%" -RemoveWedbRootOnly 2>nul
)

set "EXE=Duna.exe"
if not exist "%CD%\Duna.exe" set "EXE=Style.exe"
if not exist "%CD%\%EXE%" (
  echo ERROR: falta Duna.exe
  pause & exit /b 1
)
if not exist Usuarios mkdir Usuarios 2>nul

echo Portable sync test: %CD%
echo MAC en SuiteSync.cfg: STYLE-PORTABLE-DEV
echo Log: Usuarios\_suite_sync.log
echo Tras arrancar: Ctrl+F5 = sync manual | powershell -File TestStyleSync.ps1
echo.

start "" /D "%STYLE_HOME%" "%STYLE_HOME%%EXE%"
'@
Set-Content (Join-Path $PortableRoot "IniciarStyle.bat") -Value $bat -Encoding ASCII
Copy-Item $dbcScript (Join-Path $PortableRoot "ensure-style-dbc.ps1") -Force

Write-Host ""
Write-Host "Listo. Arranca:" -ForegroundColor Green
Write-Host "  $PortableRoot\IniciarStyle.bat"
Write-Host ""
Write-Host "Verificar red:" -ForegroundColor Cyan
Write-Host "  cd `"$PortableRoot`""
Write-Host "  powershell -File TestStyleSync.ps1"
Write-Host "  powershell -File DiagnosticarSuiteSync.ps1"

# Variable para pipeline legacy -> mismo DBF
Write-Host ""
Write-Host "LEGACY_DBF_DIR para import batch:" -ForegroundColor Yellow
Write-Host "  $($PortableRoot)\dbf"
