# Build Style Duna.exe — automatiza todo salvo BUILD PROJECT (requiere VFP IDE + PM).
#
# Uso:
#   .\scripts\build-style-duna.ps1              # preparar + compilar PRGs
#   .\scripts\build-style-duna.ps1 -AfterBuild  # tras DO VfpBuildProject en VFP
#   .\scripts\build-style-duna.ps1 -DeployTest    # copia Duna.exe a Style-Suite-Test
#   .\scripts\build-style-duna.ps1 -DeployVm      # deploy-duna-exe-vm.ps1
#
param(
    [string]$ExportRoot = "C:\Duna\Export",
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [switch]$AfterBuild,
    [switch]$SkipRepair,
    [switch]$SkipPrepare,
    [switch]$DeployTest,
    [switch]$DeployVm,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"
$Progs = Join-Path $ExportRoot "PROGS"
$Log = Join-Path $ExportRoot "build_mscomctl.log"

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
    $proc = Start-Process -FilePath $VfpExe -ArgumentList "`"$PrgPath`"" -WorkingDirectory $ExportRoot -PassThru -WindowStyle Hidden
    $null = $proc.WaitForExit($TimeoutSec * 1000)
    if (-not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        throw "Timeout VFP ($TimeoutSec s): $PrgPath"
    }
    Get-Process -Name vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Sync-SuitePrgs {
    $files = @("general.prg", "funciones.prg", "suite_full_unlock.prg")
    foreach ($f in $files) {
        $src = Join-Path $VfpRepo $f
        if (-not (Test-Path $src)) { throw "Falta $src" }
        Copy-Item $src (Join-Path $Progs $f) -Force
        Write-Ok "$f -> Export\PROGS ($((Get-Item $src).Length) bytes)"
    }
}

function Test-PrgCompileOk {
    if (-not (Test-Path $Log)) { return $false }
    $tail = Get-Content $Log -Tail 30 -ErrorAction SilentlyContinue
    if ($tail -match "ABORT: compile") { return $false }
    foreach ($base in @("general", "funciones", "suite_full_unlock")) {
        $err = Join-Path $Progs "$base.ERR"
        if (Test-Path $err) { return $false }
    }
    return $true
}

function Show-UserBuildStep {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host " TU UNICO PASO MANUAL (VFP9 IDE)" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host @"

  1. Abre Visual FoxPro 9
  2. File > Open Project > C:\Duna\Export\mscomctl
     (deja Project Manager abierto)
  3. Ventana de comandos (Ctrl+F2):

       SET DEFAULT TO C:\Duna\Export
       DO PROGS\VfpBuildProject.prg

     Si falla el script: martillo Build > Win32 executable
     carpeta C:\Duna\Export\

  4. Cuando termine, en PowerShell:

       cd C:\Users\OportoW11\Suite\suite
       .\scripts\build-style-duna.ps1 -AfterBuild

"@ -ForegroundColor White
}

# --- Solo post-build (usuario ya hizo VfpBuildProject) ---
if ($AfterBuild) {
    Write-Step "Post-build"
    & (Join-Path $RepoRoot "scripts\copy-duna-exe.ps1")
    $duna = Join-Path $ExportRoot "Duna.exe"
    if (-not (Test-Path $duna)) { throw "No existe $duna — ejecuta VfpBuildProject en VFP primero" }
    $fi = Get-Item $duna
    Write-Ok ("Duna.exe  {0:N0} bytes  {1}" -f $fi.Length, $fi.LastWriteTime)
    if ($DeployTest) {
        Write-Step "Copiar a test"
        Copy-Item $duna (Join-Path $TestRoot "Duna.exe") -Force
        Write-Ok "Duna.exe -> $TestRoot"
        & (Join-Path $RepoRoot "scripts\setup-style-from-z.ps1") -DestRoot $TestRoot -SkipEmpresaCopy -KeepBuiltExe
    }
    if ($DeployVm) {
        & (Join-Path $RepoRoot "scripts\deploy-duna-exe-vm.ps1")
    }
    Write-Host ""
    Write-Ok "Post-build listo. Arranca Style y revisa Usuarios\_suite_sync.log ([BOOT-04] / [INIT-03])"
    exit 0
}

# --- Fase automatizada ---
Write-Step "build-style-duna (automatizado)"
Write-Host "Export: $ExportRoot"

if (-not (Test-Path $VfpExe)) { throw "Instala VFP9 en $VfpExe" }
if (-not (Test-Path (Join-Path $ExportRoot "mscomctl.pjx"))) {
    throw "Falta $ExportRoot\mscomctl.pjx — necesitas el export en C:\Duna\Export"
}

Write-Step "1/4 PRGs Suite desde repo"
if (-not (Test-Path $Progs)) { New-Item -ItemType Directory -Path $Progs -Force | Out-Null }
Sync-SuitePrgs

if (-not $SkipPrepare) {
    Write-Step "2/4 PrepararExportBuild"
    $prep = Join-Path $VfpRepo "PrepararExportBuild.bat"
    if (-not (Test-Path $prep)) { throw "Falta $prep" }
    & cmd /c "`"$prep`""
    if ($LASTEXITCODE -ne 0) { throw "PrepararExportBuild.bat fallo" }
    Write-Ok "scripts de build en Export\PROGS"
}

if (-not $SkipRepair) {
    Write-Step "3/4 Reparar mscomctl.pjx (silent)"
    $repair = Join-Path $Progs "RepararProyectoSilent.prg"
    if (-not (Test-Path $repair)) {
        Copy-Item (Join-Path $VfpRepo "RepararProyectoSilent.prg") $repair -Force
        Copy-Item (Join-Path $VfpRepo "suite_repair_lib.prg") (Join-Path $Progs "suite_repair_lib.prg") -Force
        Copy-Item (Join-Path $VfpRepo "export_build_stubs.prg") (Join-Path $Progs "export_build_stubs.prg") -Force
    }
    try {
        Invoke-VfpPrg -PrgPath $repair -TimeoutSec 300
        if (Test-Path $Log) {
            Get-Content $Log -Tail 5 | ForEach-Object { if (-not $Quiet) { Write-Host "  $_" -ForegroundColor DarkGray } }
        }
        Write-Ok "RepararProyectoSilent"
    } catch {
        Write-Warn "Reparar silent fallo: $($_.Exception.Message) — puedes ejecutar RepararProyectoMscomctl.prg en VFP"
    }
}

Write-Step "4/4 Compilar general + funciones + suite_full_unlock"
$compile = Join-Path $Progs "VfpCompilePrgs.prg"
if (-not (Test-Path $compile)) {
    Copy-Item (Join-Path $VfpRepo "VfpCompilePrgs.prg") $compile -Force
}
Invoke-VfpPrg -PrgPath $compile -TimeoutSec 600
if (-not (Test-PrgCompileOk)) {
    Write-Fail "Compilacion PRG fallida. Revisa:"
    Write-Host "  $Log"
    foreach ($base in @("general", "funciones", "suite_full_unlock")) {
        $err = Join-Path $Progs "$base.ERR"
        if (Test-Path $err) { Write-Host "  --- $base.ERR ---"; Get-Content $err -Head 25 }
    }
    throw "Corrije errores en vfp\*.prg y vuelve a ejecutar build-style-duna.ps1"
}
Write-Ok "3 PRGs compilados (sin .ERR)"
if (Test-Path $Log) {
    Get-Content $Log -Tail 6 | ForEach-Object { if (-not $Quiet) { Write-Host "  $_" -ForegroundColor DarkGray } }
}

# Quitar FXP unlock suelto (runtime usa embebido o .prg en dev)
foreach ($fxp in @("suite_full_unlock.fxp", "suite_full_unlock.FXP")) {
    $p = Join-Path $Progs $fxp
    if (Test-Path $p) {
        Remove-Item $p -Force
        Write-Ok "eliminado PROGS\$fxp (no usar en runtime)"
    }
}

Write-Step "5/5 BUILD PROJECT (intento headless)"
Remove-Item $Log, (Join-Path $ExportRoot "mscomctl.ERR") -Force -ErrorAction SilentlyContinue
$repair = Join-Path $Progs "RepararProyectoSilent.prg"
$buildPrg = Join-Path $Progs "VfpBuildProject.prg"
try {
    Invoke-VfpPrg -PrgPath $repair -TimeoutSec 120
    Invoke-VfpPrg -PrgPath $buildPrg -TimeoutSec 900
} catch {
    Write-Warn $_.Exception.Message
}

$mscomctl = Join-Path $ExportRoot "mscomctl.exe"
if (Test-Path $mscomctl) {
    Write-Ok ("mscomctl.exe  {0:N0} bytes" -f (Get-Item $mscomctl).Length)
    & (Join-Path $RepoRoot "scripts\copy-duna-exe.ps1")
    $duna = Join-Path $ExportRoot "Duna.exe"
    Write-Ok ("Duna.exe  {0:N0} bytes  {1}" -f (Get-Item $duna).Length, (Get-Item $duna).LastWriteTime)
    Write-Step "Deploy test"
    Copy-Item $duna (Join-Path $TestRoot "Duna.exe") -Force
    & (Join-Path $RepoRoot "scripts\setup-style-from-z.ps1") -DestRoot $TestRoot -SkipEmpresaCopy -KeepBuiltExe
    Write-Ok "Style-Suite-Test actualizado"
    if ($DeployVm) {
        & (Join-Path $RepoRoot "scripts\deploy-duna-exe-vm.ps1")
    }
    Write-Host ""
    Write-Ok "Build completo. Revisa Usuarios\_suite_sync.log en test ([BOOT-04] / [INIT-03])"
    exit 0
}

Show-UserBuildStep
