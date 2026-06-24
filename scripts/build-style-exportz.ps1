# Build Style Duna.exe desde ExportZ (decompile Z:\Style-Dunasoft).
#
# Uso:
#   .\scripts\build-style-exportz.ps1              # preparar + compilar PRGs
#   .\scripts\build-style-exportz.ps1 -AfterBuild  # tras DO VfpBuildProject en VFP
#   .\scripts\build-style-exportz.ps1 -AfterBuild -DeployTest -SkipRepair  # post-build (default SkipRepair)
#   .\scripts\build-style-exportz.ps1 -SkipRepair:$false  # solo si necesitas repair PM (riesgo .pjt)
#   .\scripts\build-style-exportz.ps1 -DeployVm
#
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [string]$ProjectName = "mscomctlOk",  # proyecto nativo del decompile ExportZ (NO mscomctl de Export)
    [switch]$AfterBuild,
    [switch]$SkipRepair = $true,
    [switch]$SkipCompile,
    [switch]$SkipBuildExe,
    [switch]$SkipPrepare,
    [switch]$DeployTest,
    [switch]$DeployVm,
    [switch]$SyncOnly,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"
$Progs = Join-Path $ExportRoot "PROGS"
if ([string]::IsNullOrWhiteSpace($ProjectName)) {
    $ProjectName = "mscomctlOk"
}
$Log = Join-Path $ExportRoot "build_$ProjectName.log"
$Pjx = Join-Path $ExportRoot "$ProjectName.pjx"

function Write-Step([string]$Msg) {
    if (-not $Quiet) { Write-Host ""; Write-Host "=== $Msg ===" -ForegroundColor Cyan }
}
function Write-Ok([string]$Msg) { if (-not $Quiet) { Write-Host "  OK $Msg" -ForegroundColor Green } }
function Write-Warn([string]$Msg) { if (-not $Quiet) { Write-Host "  $Msg" -ForegroundColor Yellow } }
function Write-Fail([string]$Msg) { Write-Host "  ERROR: $Msg" -ForegroundColor Red }

function Invoke-VfpPrg {
    param(
        [Parameter(Mandatory)] [string]$PrgPath,
        [int]$TimeoutSec = 600
    )
    if (-not (Test-Path $VfpExe)) { throw "VFP9 no instalado: $VfpExe" }
    if (-not (Test-Path $PrgPath)) { throw "No existe $PrgPath" }
    Get-Process -Name vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    $cmd = 'set SUITE_VFP_HEADLESS=1&& "' + $VfpExe + '" /C "DO ' + $PrgPath + '"'
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WorkingDirectory $ExportRoot -PassThru -WindowStyle Hidden
    $null = $proc.WaitForExit($TimeoutSec * 1000)
    if (-not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Get-Process -Name vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        throw "Timeout VFP ($TimeoutSec s): $PrgPath"
    }
    Get-Process -Name vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Remove-LegacyUnlockFromProgs {
    param([string]$ProgsDir)
    foreach ($name in @("suite_full_unlock.prg", "suite_full_unlock.fxp", "suite_full_unlock.FXP")) {
        $p = Join-Path $ProgsDir $name
        if (Test-Path $p) {
            Remove-Item $p -Force -ErrorAction SilentlyContinue
            Write-Ok "eliminado PROGS\$name (canal v1 legacy, no usar en ExportZ)"
        }
    }
}

function Sync-SuitePrgs {
    # v2: NO copiar suite_full_unlock.prg (canal HTTP legacy) al build ExportZ.
    $files = @("general.prg", "funciones.prg", "suite_cola_sync.prg", "suite_control_sync.prg", "suite_migrar_cola_sincro.prg")
    foreach ($f in $files) {
        $src = Join-Path $VfpRepo $f
        if (-not (Test-Path $src)) { throw "Falta $src" }
        Copy-Item $src (Join-Path $Progs $f) -Force
        Write-Ok "$f -> ExportZ\PROGS ($((Get-Item $src).Length) bytes)"
    }

    # CRITICO: el #INCLUDE de VFP NO compila los PROCEDURE/FUNCTION de un .prg dentro del
    # programa anfitrion (solo procesa #DEFINE). Por eso suite_cola_sync/suite_control_sync
    # nunca quedaban embebidos (SuiteEnqueuePlan2009 ausente -> sin outbound v2).
    # Inlinamos su contenido en la copia general.prg de PROGS (el repo mantiene los #INCLUDE
    # como marcadores -> single source).
    $enc = [System.Text.Encoding]::GetEncoding(1252)
    $genSrc = Join-Path $VfpRepo "general.prg"
    $ctrlSrc = Join-Path $VfpRepo "suite_control_sync.prg"
    $colaSrc = Join-Path $VfpRepo "suite_cola_sync.prg"
    $gen = [System.IO.File]::ReadAllText($genSrc, $enc)
    if ($gen -notmatch '#INCLUDE\s+suite_cola_sync\.prg') {
        throw "general.prg sin marcador '#INCLUDE suite_cola_sync.prg' para inline"
    }
    $ctrl = [System.IO.File]::ReadAllText($ctrlSrc, $enc)
    $cola = [System.IO.File]::ReadAllText($colaSrc, $enc)
    $gen = $gen.Replace("#INCLUDE suite_control_sync.prg", $ctrl).Replace("#INCLUDE suite_cola_sync.prg", $cola)
    [System.IO.File]::WriteAllText((Join-Path $Progs "general.prg"), $gen, $enc)
    Write-Ok "general.prg con suite_control_sync + suite_cola_sync INLINE (embebidos para compilar)"
}

function Remove-StaleBuildFxp {
    param([string]$ProgsDir)
    $bases = @(
        "VfpCompilePrgs", "vfpcompileprgs",
        "VfpBuildProject", "vfpbuildproject",
        "RepararProyectoSilent", "repararproyectosilent",
        "suite_repair_lib"
    )
    foreach ($b in $bases) {
        foreach ($ext in @(".fxp", ".FXP")) {
            $p = Join-Path $ProgsDir ($b + $ext)
            if (Test-Path $p) {
                Remove-Item $p -Force -ErrorAction SilentlyContinue
                if (Test-Path $p) {
                    Write-Warn "FXP bloqueado (cierra VFP9): $($b)$ext"
                } else {
                    Write-Ok "eliminado FXP obsoleto: $($b)$ext"
                }
            }
        }
    }
}

function Sync-BuildScripts {
    $scripts = @(
        "export_build_stubs.prg",
        "suite_repair_lib.prg",
        "VfpLoadRepairLib.prg",
        "RepararProyectoSilent.prg",
        "VfpCompilePrgs.prg",
        "VfpCompileSuitePrgs.prg",
        "VfpHeadlessBuild.prg",
        "VfpBuildProject.prg",
        "RepairExportzFromLfn.prg"
    )
    foreach ($f in $scripts) {
        $src = Join-Path $VfpRepo $f
        if (-not (Test-Path $src)) { throw "Falta $src" }
        Copy-Item $src (Join-Path $Progs $f) -Force
    }
    Write-Ok "scripts de build en ExportZ\PROGS"
    Remove-StaleBuildFxp -ProgsDir $Progs
}

function Test-PrgCompileOk {
    foreach ($base in @("general", "funciones")) {
        foreach ($errName in @("$base.ERR", "$($base.ToUpper()).ERR")) {
            $err = Join-Path $Progs $errName
            if (Test-Path $err) { return $false }
        }
        $prg = Join-Path $Progs "$base.prg"
        if (-not (Test-Path $prg)) { return $false }
        $fxp = @(Get-ChildItem $Progs -Filter "$base.fxp" -ErrorAction SilentlyContinue) +
               @(Get-ChildItem $Progs -Filter "$base.FXP" -ErrorAction SilentlyContinue)
        if (-not $fxp -or $fxp.Count -eq 0) { return $false }
        $fxpItem = $fxp | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ((Get-Item $prg).LastWriteTime -gt $fxpItem.LastWriteTime) { return $false }
    }
    if (Test-Path $Log) {
        $tail = Get-Content $Log -Tail 30 -ErrorAction SilentlyContinue
        if ($tail -match "ABORT: compile") { return $false }
    }
    return $true
}

function Show-UserBuildStep {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host " BUILD NATIVO VFP9 IDE (obligatorio)" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host @"

  Si el .pjt da memo invalid: cierra VFP y ejecuta .\scripts\fix-exportz-pjt.ps1
  Luego en VFP9:
    A) File > New > Project > $ProjectName  en  $ExportRoot
       DO PROGS\RepairExportzFromLfn.prg
       File > Save
    B) O File > Open Project > $ExportRoot\$ProjectName
       Locate File: Ignore All
       DO PROGS\RepairExportzFromLfn.prg
       File > Save

  Compilar (Ctrl+F2):
       SET DEFAULT TO $ExportRoot
       COMPILE PROGS\general.prg
       COMPILE PROGS\funciones.prg
   (suite_cola_sync #INCLUDE inline al inicio de general.prg, antes del codigo ejecutable)

  Build exe:
       BUILD EXE C:\Duna\ExportZ\Duna.exe FROM $ProjectName RECOMPILE

  Post-build PowerShell:
       cd C:\Users\OportoW11\Suite\suite
       .\scripts\build-style-exportz.ps1 -AfterBuild -DeployTest
       .\scripts\validate-style-exportz-build.ps1
       .\scripts\verify-style-cutover.ps1 -NewExe "$ExportRoot\Duna.exe"

"@ -ForegroundColor White
}

if ($AfterBuild) {
    Write-Step "Post-build ExportZ"
    & (Join-Path $RepoRoot "scripts\copy-duna-exe.ps1") -ExportRoot $ExportRoot
    $duna = Join-Path $ExportRoot "Duna.exe"
    if (-not (Test-Path $duna)) { throw "No existe $duna - ejecuta VfpBuildProject en VFP primero" }
    $fi = Get-Item $duna
    Write-Ok ("Duna.exe  {0:N0} bytes  {1}" -f $fi.Length, $fi.LastWriteTime)
    if ($fi.Length -gt 34MB) {
        Write-Warn "Exe > 34 MB - revisar si arranca sin 1732 (objetivo ~30-31 MB)"
    }
    if ($DeployTest) {
        Write-Step "Copiar a test"
        Copy-Item $duna (Join-Path $TestRoot "Duna.exe") -Force
        Write-Ok "Duna.exe -> $TestRoot"
        & (Join-Path $RepoRoot "scripts\setup-style-exportz-test.ps1") -DestRoot $TestRoot
    }
    if ($DeployVm) {
        $env:SUITE_EXPORT_ROOT = $ExportRoot
        & (Join-Path $RepoRoot "scripts\deploy-duna-exe-vm.ps1")
        Remove-Item Env:SUITE_EXPORT_ROOT -ErrorAction SilentlyContinue
    }
    Write-Host ""
    Write-Ok "Post-build listo. Revisa Usuarios\_suite_sync.log ([BOOT-04] / [INIT-03])"
    exit 0
}

Write-Step "build-style-exportz (automatizado)"
Write-Host "ExportZ: $ExportRoot"
Write-Host "Proyecto: $ProjectName"

if (-not (Test-Path $VfpExe)) { throw "Instala VFP9 en $VfpExe" }
if (-not (Test-Path $Pjx)) {
    throw "Falta $Pjx - descompila Duna.exe de Z:\Style-Dunasoft en ExportZ primero"
}

Set-Content -Path (Join-Path $ExportRoot "suite_project.cfg") -Value $ProjectName -Encoding ASCII -NoNewline
Write-Ok "suite_project.cfg = $ProjectName"

Write-Step "1/4 PRGs Suite desde repo"
if (-not (Test-Path $Progs)) { New-Item -ItemType Directory -Path $Progs -Force | Out-Null }
Sync-SuitePrgs
Remove-LegacyUnlockFromProgs -ProgsDir $Progs

if ($SyncOnly) {
    Write-Ok "SyncOnly: fuentes repo -> $Progs copiadas (sin tocar VFP)."
    Write-Host ""
    Write-Host "Ahora en VFP9 IDE:" -ForegroundColor White
    Write-Host "    SET DEFAULT TO $ExportRoot" -ForegroundColor White
    Write-Host "    COMPILE PROGS\general.prg" -ForegroundColor White
    Write-Host "    COMPILE PROGS\funciones.prg" -ForegroundColor White
    Write-Host "    BUILD EXE $ExportRoot\Duna.exe FROM $ProjectName RECOMPILE" -ForegroundColor White
    exit 0
}

if (-not $SkipPrepare) {
    Write-Step "2/4 Scripts de build"
    Sync-BuildScripts
    $contaSrc = Join-Path $ExportRoot "gestion-dunasoft\gestion\vcx\conta.vcx"
    $vcxDir = Join-Path $ExportRoot "vcx"
    if (Test-Path $contaSrc) {
        Copy-Item $contaSrc (Join-Path $vcxDir "conta.vcx") -Force -ErrorAction SilentlyContinue
        Copy-Item (Join-Path $ExportRoot "gestion-dunasoft\gestion\vcx\conta.vct") (Join-Path $vcxDir "conta.vct") -Force -ErrorAction SilentlyContinue
    }
    $scxDir = Join-Path $ExportRoot "scx"
    $saldosTactil = Join-Path $scxDir "saldos_tactil.scx"
    $saldos = Join-Path $scxDir "saldos.scx"
    $selCentros = Join-Path $scxDir "seleccioncentros.scx"
    if ((Test-Path $saldosTactil) -and -not (Test-Path $saldos)) {
        Copy-Item $saldosTactil $saldos -Force
        Copy-Item (Join-Path $scxDir "saldos_tactil.sct") (Join-Path $scxDir "saldos.sct") -Force -ErrorAction SilentlyContinue
        Write-Ok "saldos.scx desde saldos_tactil (stub build)"
    }
    if ((Test-Path $saldosTactil) -and -not (Test-Path $selCentros)) {
        Copy-Item $saldosTactil $selCentros -Force
        Copy-Item (Join-Path $scxDir "saldos_tactil.sct") (Join-Path $scxDir "seleccioncentros.sct") -Force -ErrorAction SilentlyContinue
        Write-Ok "seleccioncentros.scx desde saldos_tactil (stub build)"
    }
}

if (-not $SkipRepair) {
    $fixPjt = Join-Path $RepoRoot "scripts\fix-exportz-pjt.ps1"
    if (Test-Path $fixPjt) {
        Write-Step "2b/4 Limpiar .pjt ExportZ (rutas basura ReFox)"
        & $fixPjt -ExportRoot $ExportRoot -Stem $ProjectName
    }
    # NO copiar mscomctl.pjx desde C:\Duna\Export (home Export → PJT corrupto en ExportZ; exe 1732).
    # Proyecto nativo: mscomctlOk.pjx del decompile Z en ExportZ.
    if ($ProjectName -ieq "mscomctl") {
        Write-Warn "Proyecto mscomctl es de Export (descartado). Usa mscomctlOk en ExportZ."
        $ProjectName = "mscomctlOk"
        $Pjx = Join-Path $ExportRoot "$ProjectName.pjx"
        $Log = Join-Path $ExportRoot "build_$ProjectName.log"
    }
    Set-Content -Path (Join-Path $ExportRoot "suite_project.cfg") -Value $ProjectName -Encoding ASCII -NoNewline
    Write-Step "3/4 Reparar $ProjectName.pjx (silent)"
    $repair = Join-Path $Progs "RepararProyectoSilent.prg"
    try {
        Invoke-VfpPrg -PrgPath $repair -TimeoutSec 300
        if (Test-Path $Log) {
            Get-Content $Log -Tail 8 | ForEach-Object { if (-not $Quiet) { Write-Host "  $_" -ForegroundColor DarkGray } }
        }
        Write-Ok "RepararProyectoSilent"
    } catch {
        Write-Warn "Reparar silent fallo: $($_.Exception.Message)"
    }
}

Write-Step "4/4 Compilar general + funciones"
if ($SkipCompile -and (Test-PrgCompileOk)) {
    Write-Ok "SkipCompile: FXP al dia (general + funciones)"
} else {
Remove-StaleBuildFxp -ProgsDir $Progs
$compile = Join-Path $Progs "VfpCompilePrgs.prg"
Invoke-VfpPrg -PrgPath $compile -TimeoutSec 600
if (-not (Test-PrgCompileOk)) {
    Write-Fail "Compilacion PRG fallida. Revisa:"
    Write-Host "  $Log"
    foreach ($base in @("general", "funciones")) {
        $err = Join-Path $Progs "$base.ERR"
        if (Test-Path $err) { Write-Host "  --- $base.ERR ---"; Get-Content $err -Head 25 }
    }
    throw "Corrije errores en vfp\*.prg y vuelve a ejecutar build-style-exportz.ps1"
}
Write-Ok "general + funciones compilados (sin .ERR)"
if (Test-Path $Log) {
    Get-Content $Log -Tail 6 | ForEach-Object { if (-not $Quiet) { Write-Host "  $_" -ForegroundColor DarkGray } }
}
}

foreach ($fxp in @("suite_full_unlock.fxp", "suite_full_unlock.FXP")) {
    $p = Join-Path $Progs $fxp
    if (Test-Path $p) {
        Remove-Item $p -Force
        Write-Ok "eliminado PROGS\$fxp"
    }
}
Remove-LegacyUnlockFromProgs -ProgsDir $Progs

Write-Step "5/5 BUILD exe (VfpBuildProject headless, sin SendKeys)"
$buildOk = $false
if ($SkipBuildExe) {
    Write-Ok "SkipBuildExe: compilar en VFP9 IDE (BUILD EXE Duna.exe FROM $ProjectName RECOMPILE)"
} else {
$buildPrg = Join-Path $Progs "VfpBuildProject.prg"
try {
    Invoke-VfpPrg -PrgPath $buildPrg -TimeoutSec 120
    $builtExe = Join-Path $ExportRoot "$ProjectName.exe"
    if (Test-Path $builtExe) {
        $buildOk = $true
    }
} catch {
    Write-Warn $_.Exception.Message
}
}

$builtExe = Join-Path $ExportRoot "$ProjectName.exe"
if ($buildOk -and (Test-Path $builtExe)) {
    Write-Ok ("$ProjectName.exe  {0:N0} bytes" -f (Get-Item $builtExe).Length)
    & (Join-Path $RepoRoot "scripts\copy-duna-exe.ps1") -ExportRoot $ExportRoot
    $duna = Join-Path $ExportRoot "Duna.exe"
    Write-Ok ("Duna.exe  {0:N0} bytes  {1}" -f (Get-Item $duna).Length, (Get-Item $duna).LastWriteTime)
    if ($DeployTest) {
        Copy-Item $duna (Join-Path $TestRoot "Duna.exe") -Force
        & (Join-Path $RepoRoot "scripts\setup-style-exportz-test.ps1") -DestRoot $TestRoot
    }
    if ($DeployVm) {
        $env:SUITE_EXPORT_ROOT = $ExportRoot
        & (Join-Path $RepoRoot "scripts\deploy-duna-exe-vm.ps1")
        Remove-Item Env:SUITE_EXPORT_ROOT -ErrorAction SilentlyContinue
    }
    Write-Ok "Build completo. Revisa Usuarios\_suite_sync.log"
    exit 0
}

Show-UserBuildStep
Write-Host ""
Write-Warn "BUILD EXE requiere VFP9 IDE (ReFox no compila ni enlaza el proyecto v2)."
