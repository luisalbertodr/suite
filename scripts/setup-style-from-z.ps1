# Monta entorno Style de prueba desde Z:\Style-Dunasoft (exe que arranca)
# sin usar C:\Duna\Export. Parches minimos Suite segun STYLE-SUITE-PARCHES-EXPORT.md.
#
# Reglas aprendidas:
#   - Duna.exe SIEMPRE desde Z (nunca Export ~35 MB -> error 1732)
#   - NO tocar/borrar funciones.fxp ni general.fxp sin recompilar desde repo
#   - suite_full_unlock.fxp SIEMPRE en cuarentena (VFP prefiere .fxp -> clases rotas)
#   - Sync en exe Z viejo: recompilar general+funciones .fxp desde vfp\*.prg (no rebuild exe)
#
# Uso:
#   .\scripts\setup-style-from-z.ps1
#   .\scripts\setup-style-from-z.ps1 -DestRoot 'C:\Duna\Style-Suite-Test' -SkipCompile
#   .\scripts\setup-style-from-z.ps1 -FullProgsReset

param(
    [string]$SourceRoot = "Z:\Style-Dunasoft",
    [string]$DestRoot = "C:\Duna\Style-Suite-Test",
    [switch]$SkipCompile = $true,
    [switch]$FullProgsReset,
    [switch]$SkipEmpresaCopy,
    [switch]$TryCompile,
    [switch]$KeepBuiltExe
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"

$SourceRoot = [IO.Path]::GetFullPath($SourceRoot.TrimEnd('\'))
$DestRoot = [IO.Path]::GetFullPath($DestRoot.TrimEnd('\'))

if (-not (Test-Path $SourceRoot)) {
    throw "No accesible: $SourceRoot (monta Z:\Style-Dunasoft)"
}
if (-not (Test-Path (Join-Path $SourceRoot "Duna.exe"))) {
    throw "Falta Duna.exe en $SourceRoot"
}

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "=== $Msg ===" -ForegroundColor Cyan
}

function Move-ToQuarantine {
    param([string]$Path, [string]$QuarantineDir)
    if (-not (Test-Path $Path)) { return }
    if (-not (Test-Path $QuarantineDir)) {
        New-Item -ItemType Directory -Path $QuarantineDir -Force | Out-Null
    }
    $name = Split-Path $Path -Leaf
    $dst = Join-Path $QuarantineDir $name
    if (Test-Path $dst) { Remove-Item $dst -Force }
    Move-Item $Path $dst -Force
    Write-Host "  cuarentena: $name" -ForegroundColor Yellow
}

Write-Step "setup-style-from-z"
Write-Host "Origen:  $SourceRoot"
Write-Host "Destino: $DestRoot"

if (-not (Test-Path $DestRoot)) {
    New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null
    Write-Host "Creado $DestRoot" -ForegroundColor Green
}

$quarantine = Join-Path $DestRoot ("_suite_quarantine\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $quarantine -Force | Out-Null

# --- Duna.exe desde Z (nunca Export), salvo -KeepBuiltExe tras build ---
if ($KeepBuiltExe -and (Test-Path (Join-Path $DestRoot "Duna.exe"))) {
    Write-Step "Duna.exe"
    $fi = Get-Item (Join-Path $DestRoot "Duna.exe")
    Write-Host "  conservado build en test ($($fi.Length) bytes $($fi.LastWriteTime))" -ForegroundColor Green
} else {
Write-Step "Duna.exe desde Z"
$srcExe = Join-Path $SourceRoot "Duna.exe"
$dstExe = Join-Path $DestRoot "Duna.exe"
if (Test-Path $dstExe) {
    $bakExe = Join-Path $quarantine "Duna.exe.bak"
    Copy-Item $dstExe $bakExe -Force
}
Copy-Item $srcExe $dstExe -Force
$hashZ = (Get-FileHash $srcExe -Algorithm SHA256).Hash.Substring(0, 12)
$sz = (Get-Item $dstExe).Length
Write-Host "  OK Duna.exe $sz bytes SHA256:$hashZ" -ForegroundColor Green
if ($sz -gt 32MB) {
    Write-Host "  AVISO: exe > 32 MB — podria ser build Export roto. Usa solo Z." -ForegroundColor Red
}
}

# --- PROGS ---
$destProgs = Join-Path $DestRoot "PROGS"
if ($KeepBuiltExe) {
    Write-Step "PROGS (exe embebido — sin FXP externos)"
    if (Test-Path $destProgs) {
        Get-ChildItem $destProgs -File | ForEach-Object {
            Move-ToQuarantine -Path $_.FullName -QuarantineDir (Join-Path $quarantine "progs_built")
        }
        Write-Host "  PROGS vaciado (evita 1732 por funciones.fxp de Z)" -ForegroundColor Green
    }
} else {

Write-Step "PROGS (base Z + parches repo)"
$srcProgs = Join-Path $SourceRoot "PROGS"
if (-not (Test-Path $srcProgs)) {
    throw "Falta $srcProgs"
}

if ($FullProgsReset -and (Test-Path $destProgs)) {
    $progsBak = Join-Path $quarantine "PROGS_full"
    Copy-Item $destProgs $progsBak -Recurse -Force
    Remove-Item $destProgs -Recurse -Force
    Write-Host "  backup PROGS completo en $progsBak" -ForegroundColor DarkGray
}

if (-not (Test-Path $destProgs)) {
    New-Item -ItemType Directory -Path $destProgs -Force | Out-Null
}

# Copiar solo lo que existe en Z PROGS
Get-ChildItem $srcProgs -File | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $destProgs $_.Name) -Force
    Write-Host "  Z -> $($_.Name)" -ForegroundColor DarkGray
}

# Overlay parches repo (solo unlock; funciones/general de Z salvo -TryCompile)
$patchPrgs = @("suite_full_unlock.prg")
if ($TryCompile -and -not $SkipCompile) {
    $patchPrgs = @("general.prg", "funciones.prg", "suite_full_unlock.prg")
} else {
    foreach ($p in @("general.prg", "funciones.prg")) {
        $zPrg = Join-Path $srcProgs $p
        if (Test-Path $zPrg) {
            Copy-Item $zPrg (Join-Path $destProgs $p) -Force
        }
    }
}
foreach ($p in $patchPrgs) {
    $src = Join-Path $VfpRepo $p
    if (-not (Test-Path $src)) { throw "Falta $src" }
    Copy-Item $src (Join-Path $destProgs $p) -Force
    $bytes = (Get-Item $src).Length
    Write-Host "  repo -> $p ($bytes bytes)" -ForegroundColor Green
}

# Cuarentena suite_full_unlock.fxp (siempre)
foreach ($fxpName in @("suite_full_unlock.fxp", "suite_full_unlock.FXP")) {
    Move-ToQuarantine -Path (Join-Path $destProgs $fxpName) -QuarantineDir $quarantine
}

# Eliminar archivos PROGS que no estan en Z (contaminacion Export)
$zNames = @(Get-ChildItem $srcProgs -File | ForEach-Object { $_.Name.ToLower() })
$zNames += @("suite_full_unlock.prg")
$zSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($n in $zNames) { [void]$zSet.Add($n) }

$removed = 0
Get-ChildItem $destProgs -File | ForEach-Object {
    if (-not $zSet.Contains($_.Name)) {
        Move-ToQuarantine -Path $_.FullName -QuarantineDir $quarantine
        $removed++
    }
}
if ($removed -gt 0) {
    Write-Host "  eliminados $removed archivos PROGS ajenos a Z" -ForegroundColor Yellow
}

# --- Recompilar FXP (solo util con exe sin loader embebido; -TryCompile -SkipCompile:$false) ---
$compileAttempted = $false
if ($TryCompile -and -not $SkipCompile) {
    $compileAttempted = $true
    Write-Step "Compilar PRGs a FXP (VFP9)"
    if (-not (Test-Path $VfpExe)) {
        Write-Host "  VFP9 no instalado" -ForegroundColor Yellow
        $compileAttempted = $false
    } else {
        $preCompile = Join-Path $quarantine "pre_compile"
        New-Item -ItemType Directory -Path $preCompile -Force | Out-Null
        $toCompile = if ($TryCompile) { @("general.prg", "funciones.prg", "suite_full_unlock.prg") } else { @("funciones.prg") }
        foreach ($fxp in @("general.fxp", "general.FXP", "funciones.fxp", "funciones.FXP")) {
            Move-ToQuarantine -Path (Join-Path $destProgs $fxp) -QuarantineDir $preCompile
        }
        $runner = Join-Path $DestRoot "_suite_compile_runner.prg"
        $lines = @("SET SAFETY OFF", "SET DEFAULT TO $DestRoot", "STRTOFILE('start '+TTOC(DATETIME())+CHR(13), 'Usuarios\_compile_suite.log', .F.)")
        foreach ($prg in $toCompile) {
            $lines += "COMPILE PROGS\$prg"
        }
        $lines += @(
            "IF FILE('PROGS\suite_full_unlock.fxp')",
            "   ERASE PROGS\suite_full_unlock.fxp",
            "ENDIF",
            "STRTOFILE('done'+CHR(13), 'Usuarios\_compile_suite.log', .T.)",
            "QUIT"
        )
        Set-Content $runner ($lines -join "`r`n") -Encoding ASCII
        Get-Process -Name vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        $proc = Start-Process -FilePath $VfpExe -ArgumentList "`"$runner`"" -WorkingDirectory $DestRoot -PassThru -WindowStyle Hidden
        $null = $proc.WaitForExit(300000)
        if (Test-Path (Join-Path $DestRoot "Usuarios\_compile_suite.log")) {
            Get-Content (Join-Path $DestRoot "Usuarios\_compile_suite.log") -Tail 4 | ForEach-Object { Write-Host "  $_" }
        }
        foreach ($need in @("general.fxp", "funciones.fxp")) {
            $p = Join-Path $destProgs $need
            if (-not (Test-Path $p)) {
                $alt = Join-Path $destProgs ($need -replace '\.fxp$', '.FXP')
                if (Test-Path $alt) { Rename-Item $alt $need -Force }
            }
            if (Test-Path $p) {
                Write-Host "  OK $need" -ForegroundColor Green
            } elseif (Test-Path (Join-Path $preCompile $need)) {
                Copy-Item (Join-Path $preCompile $need) $p -Force
                Write-Host "  restaurado $need de Z" -ForegroundColor Yellow
            }
        }
        Remove-Item $runner -Force -ErrorAction SilentlyContinue
        foreach ($fxpName in @("suite_full_unlock.fxp", "suite_full_unlock.FXP")) {
            Move-ToQuarantine -Path (Join-Path $destProgs $fxpName) -QuarantineDir $quarantine
        }
    }
} elseif (-not $SkipCompile) {
    Write-Host "  Use -TryCompile para compilar FXP (exe Z ignora funciones.fxp externo si hay loader embebido)" -ForegroundColor DarkGray
} else {
    Write-Host "  FXP de Z sin recompilar (arranque Lipout seguro)" -ForegroundColor Green
}
}

# --- Scripts y arranque ---
Write-Step "Scripts de arranque"
Copy-Item (Join-Path $RepoRoot "scripts\ensure-style-dbc.ps1") (Join-Path $DestRoot "ensure-style-dbc.ps1") -Force

$bat = @"
@echo off
setlocal
set "STYLE_HOME=%~dp0"
cd /d "%STYLE_HOME%"
set "STYLE_HOME=%CD%"

if exist "%~dp0ensure-style-dbc.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-style-dbc.ps1" -StyleRoot "%CD%" -RemoveWedbRootOnly 2>nul
)

set "EXE=Duna.exe"
if not exist "%CD%\Duna.exe" (
  echo ERROR: falta Duna.exe — ejecuta scripts\setup-style-from-z.ps1
  pause & exit /b 1
)
if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg
  pause & exit /b 1
)
if not exist Usuarios mkdir Usuarios 2>nul

REM suite_full_unlock.fxp rompe DEFINE CLASS (1732). Solo .prg externo.
if exist "%CD%\PROGS\suite_full_unlock.fxp" ren "%CD%\PROGS\suite_full_unlock.fxp" suite_full_unlock.fxp.bak >nul 2>&1
if exist "%CD%\PROGS\suite_full_unlock.FXP" ren "%CD%\PROGS\suite_full_unlock.FXP" suite_full_unlock.fxp.bak >nul 2>&1

echo Style test (exe Z): %CD%
echo Log: Usuarios\_suite_sync.log
echo.

start "" /D "%STYLE_HOME%" "%STYLE_HOME%Duna.exe"
"@
Set-Content -Path (Join-Path $DestRoot "IniciarStyle.bat") -Value $bat -Encoding ASCII
Write-Host "  OK IniciarStyle.bat" -ForegroundColor Green

# config.fpw — DEFAULT fija cwd (COMMAND no aplica en Duna.exe compilado)
@"
* VFP: directorio de trabajo = raiz Style (mitiga cwd en dbf\ del exe Z)
DEFAULT=$DestRoot
RESOURCE=OFF
MVCOUNT=4096
"@ | Set-Content (Join-Path $DestRoot "config.fpw") -Encoding ASCII
Write-Host "  OK config.fpw DEFAULT=$DestRoot" -ForegroundColor Green

# SuiteSync.cfg (preservar token test si existe)
$cfgDest = Join-Path $DestRoot "SuiteSync.cfg"
if (-not (Test-Path $cfgDest)) {
    $example = Join-Path $VfpRepo "SuiteSync.cfg.example"
    if (Test-Path $example) {
        $content = Get-Content $example -Raw
        $content = $content -replace 'SYNC_MAC=STYLE-VM', 'SYNC_MAC=STYLE-PORTABLE-DEV'
        $content = $content -replace 'SYNC_INTERVAL=30', 'SYNC_INTERVAL=10'
        Set-Content $cfgDest $content -Encoding ASCII
        Write-Host "  OK SuiteSync.cfg (plantilla — revisa SYNC_TOKEN)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  conservado SuiteSync.cfg existente" -ForegroundColor Green
}

# EMPRESA / idioma desde Z
if (-not $SkipEmpresaCopy) {
    Write-Step "Config empresa desde Z"
    & (Join-Path $RepoRoot "scripts\sync-style-config-from-z.ps1") -SourceRoot $SourceRoot -DestRoot $DestRoot
}

# LEEME
$leeme = @"
Style-Suite-Test — montado desde Z con parches minimos
========================================================
Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

Exe: Duna.exe de Z (SHA256:$hashZ) — NO usar C:\Duna\Export

Parches aplicados:
  - Duna.exe de Z (~30,8 MB) — NO usar Export (~35 MB, error 1732)
  - PROGS limpio (solo archivos de Z + suite_full_unlock.prg repo)
  - suite_full_unlock.fxp en cuarentena (obligatorio)
  - general.fxp + funciones.fxp de Z (intactos)
  - config.fpw DEFAULT=$DestRoot

LIMITACION exe Z:
  El loader SuiteLoadUnlock esta EMBEBIDO en Duna.exe; PROGS\funciones.fxp
  externo NO sustituye ese codigo. Sync seguira en [BOOT-07] hasta rebuild VFP9:
    BUILD-DUNA.bat en Export con mscomctl.pjx + los 3 PRGs del repo embebidos.

Arranque Lipout: IniciarStyle.bat (debe abrir sin error 1732)
Log sync: Usuarios\_suite_sync.log

Cuarentena de esta pasada: $quarantine
"@
Set-Content (Join-Path $DestRoot "LEEME-ARRANQUE.txt") $leeme -Encoding UTF8

Write-Step "Listo"
Write-Host "Destino: $DestRoot"
Write-Host "Cuarentena: $quarantine"
Write-Host "Arranque:  $DestRoot\IniciarStyle.bat" -ForegroundColor Cyan
