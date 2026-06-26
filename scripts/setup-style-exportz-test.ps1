# Monta entorno de prueba para build ExportZ (exe embebido, sin PROGS/FXP externos).
#
# Uso:
#   .\scripts\setup-style-exportz-test.ps1
#   .\scripts\setup-style-exportz-test.ps1 -DestRoot 'C:\Duna\Style-Suite-Test'
#
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$DestRoot = "C:\Duna\Style-Suite-Test",
    [string]$SourceRoot = "Z:\Style-Dunasoft",
    [switch]$SkipEmpresaCopy,
    [switch]$KeepProgsFallback
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"

$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$DestRoot = [IO.Path]::GetFullPath($DestRoot.TrimEnd('\'))

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "=== $Msg ===" -ForegroundColor Cyan
}

function Write-Warn([string]$Msg) { Write-Host "  AVISO: $Msg" -ForegroundColor Yellow }


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

Write-Step "setup-style-exportz-test"
Write-Host "ExportZ: $ExportRoot"
Write-Host "Destino: $DestRoot"

if (-not (Test-Path $DestRoot)) {
    New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null
}

$duna = Join-Path $DestRoot "Duna.exe"
if (-not (Test-Path $duna)) {
    throw "Falta $duna - ejecuta build-style-exportz.ps1 -AfterBuild -DeployTest primero"
}

$quarantine = Join-Path $DestRoot ("_suite_quarantine\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $quarantine -Force | Out-Null

Write-Step "vcx runtime (solo arranque; sin VCX decompilados de agenda/planificador)"
$vcxDst = Join-Path $DestRoot "vcx"
$runtimeVcx = @(
    "licencias.vcx", "licencias.vct",
    "seguridad.vcx", "seguridad.vct",
    "screen_nueva.vcx", "screen_nueva.vct",
    "tickets_nuevo.vcx", "tickets_nuevo.vct"
)
$vcxSources = @($ExportRoot, $SourceRoot) | Where-Object { Test-Path $_ }
if (-not (Test-Path $vcxDst)) { New-Item -ItemType Directory -Path $vcxDst -Force | Out-Null }
foreach ($srcRoot in $vcxSources) {
    $vcxSrc = Join-Path $srcRoot "vcx"
    if (-not (Test-Path $vcxSrc)) { continue }
    foreach ($name in $runtimeVcx) {
        $src = Join-Path $vcxSrc $name
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $vcxDst $name) -Force
        }
    }
}
# VCX decompilados rompen drag-drop en Style: solo runtime (como Z:\)
$vcxQuarantine = Join-Path $quarantine "vcx_decompiled"
$runtimeVcxSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$runtimeVcx)
Get-ChildItem $vcxDst -File -ErrorAction SilentlyContinue | ForEach-Object {
    if (-not $runtimeVcxSet.Contains($_.Name)) {
        Move-ToQuarantine -Path $_.FullName -QuarantineDir $vcxQuarantine
    }
}
$cnt = (Get-ChildItem $vcxDst -File -ErrorAction SilentlyContinue).Count
Write-Host "  OK $cnt archivos en vcx\ (runtime)" -ForegroundColor Green

Write-Step "PROGS (fallback worker; sync v2 en general.prg #INCLUDE)"
$destProgs = Join-Path $DestRoot "PROGS"
if (-not (Test-Path $destProgs)) {
    New-Item -ItemType Directory -Path $destProgs -Force | Out-Null
}
Get-ChildItem $destProgs -File | ForEach-Object {
    $keep = @(
        "_inbound_once.prg", "run_inbound_worker.bat", "run_inbound_worker_hidden.vbs",
        "suite_inbound_worker_sync.prg"
    ) -contains $_.Name
    if (-not $keep) {
        Move-ToQuarantine -Path $_.FullName -QuarantineDir (Join-Path $quarantine "progs_old")
    }
}
$v2Prgs = @(
    "suite_cola_sync.prg", "suite_control_sync.prg", "suite_migrar_cola_sincro.prg",
    "suite_inbound_worker.prg", "suite_local_test_init.prg", "suite_v2_startup.prg",
    "suite_apply_license_unlock.prg", "funciones.prg"
)
foreach ($f in $v2Prgs) {
    $src = Join-Path $VfpRepo $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $destProgs $f) -Force
        Write-Host "  OK $f" -ForegroundColor Green
    }
}
# Nunca desplegar funciones.fxp / general.fxp: con PROGS en PATH, VFP los carga en lugar del
# funciones embebido en Duna.exe (sin sync v2) y TYPE(SuiteEnqueuePlan2009) queda en U.
foreach ($stale in @("funciones.fxp", "funciones.FXP", "general.fxp", "general.FXP")) {
    $p = Join-Path $destProgs $stale
    if (Test-Path $p) {
        Move-ToQuarantine -Path $p -QuarantineDir (Join-Path $quarantine "progs_stale_fxp")
    }
}
Copy-Item (Join-Path $destProgs "suite_cola_sync.prg") (Join-Path $DestRoot "suite_cola_sync.prg") -Force -ErrorAction SilentlyContinue
if ($KeepProgsFallback) {
    Copy-Item (Join-Path $VfpRepo "suite_full_unlock.prg") (Join-Path $destProgs "suite_full_unlock.prg") -Force
    Write-Host "  fallback: suite_full_unlock.prg" -ForegroundColor DarkGray
}

Write-Step "DBF runtime desde ExportZ"
$runtimeDbfs = @("_menus.dbf", "_menus.cdx", "foxypreviewer_locs.dbf")
foreach ($name in $runtimeDbfs) {
    $src = Join-Path $ExportRoot $name
    if (-not (Test-Path $src)) { continue }
    Copy-Item $src (Join-Path $DestRoot $name) -Force
    Write-Host "  OK $name" -ForegroundColor Green
}
if (-not (Test-Path (Join-Path $DestRoot "_menus.dbf"))) {
    Write-Warn "Falta _menus.dbf en ExportZ - Style pedira Buscar al arrancar"
}

Write-Step "Scripts de arranque"
Copy-Item (Join-Path $RepoRoot "scripts\ensure-style-dbc.ps1") (Join-Path $DestRoot "ensure-style-dbc.ps1") -Force
Copy-Item (Join-Path $VfpRepo "IniciarStyle.bat") (Join-Path $DestRoot "IniciarStyle.bat") -Force
Write-Host "  OK IniciarStyle.bat (vfp/IniciarStyle.bat)" -ForegroundColor Green

@"
* VFP: directorio de trabajo = raiz Style
DEFAULT=$DestRoot
STARTUP=PROGS\suite_v2_startup.prg
RESOURCE=OFF
MVCOUNT=4096
"@ | Set-Content (Join-Path $DestRoot "config.fpw") -Encoding ASCII

$cfgDest = Join-Path $DestRoot "SuiteSync.cfg"
if (-not (Test-Path $cfgDest)) {
    $example = Join-Path $VfpRepo "SuiteSync.cfg.example"
    if (Test-Path $example) {
        $content = Get-Content $example -Raw
        $content = $content -replace 'SYNC_MAC=STYLE-VM', 'SYNC_MAC=STYLE-PORTABLE-DEV'
        $content = $content -replace 'SYNC_INTERVAL=30', 'SYNC_INTERVAL=10'
        Set-Content $cfgDest $content -Encoding ASCII
        Write-Host "  OK SuiteSync.cfg (revisa SYNC_TOKEN)" -ForegroundColor Yellow
    }
}

if (-not $SkipEmpresaCopy -and (Test-Path $SourceRoot)) {
    Write-Step "Config empresa desde Z"
    & (Join-Path $RepoRoot "scripts\sync-style-config-from-z.ps1") -SourceRoot $SourceRoot -DestRoot $DestRoot
}

Write-Step "Runtime sync v2"
& (Join-Path $RepoRoot "scripts\deploy-style-sync-runtime.ps1") -StyleRoot $DestRoot -AgentDir (Join-Path $RepoRoot "style-sync-agent")

$fi = Get-Item $duna
$leeme = @"
Style-Suite-Test - build ExportZ (decompile Z)
==============================================
Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

Duna.exe: $($fi.Length) bytes $($fi.LastWriteTime)
Origen build: $ExportRoot

Reglas:
  - PROGS: solo PRGs worker (sin funciones.fxp ni general.fxp)
  - Sync v2 embebida en Duna.exe (#INCLUDE en general.prg)
  - Nunca suite_full_unlock.fxp en PROGS
  - vcx copiado desde ExportZ

Log: Usuarios\_suite_sync.log
Esperado: [BOOT-04] [INIT-03]

Cuarentena: $quarantine
"@
Set-Content (Join-Path $DestRoot "LEEME-ARRANQUE.txt") $leeme -Encoding UTF8

Write-Step "Listo"
Write-Host "Arranque: $DestRoot\IniciarStyle.bat" -ForegroundColor Cyan
