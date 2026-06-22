# Prepara mscomctlOk en ExportZ (sin scrub del .pjt - rompe el memo).
#
# Uso (VFP cerrado):
#   .\scripts\fix-exportz-pjt.ps1
#
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$Stem = "mscomctlOk"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$Pjx = Join-Path $ExportRoot "$Stem.pjx"
$Pjt = Join-Path $ExportRoot "$Stem.pjt"

Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

if (-not (Test-Path $Pjx)) { throw "Falta $Pjx" }

$bak = Join-Path $ExportRoot "backup_pjx"
New-Item -ItemType Directory -Path $bak -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Restaurar .pjt original del decompile (el scrub invalida el memo)
$original = Get-ChildItem $bak -Filter "$Stem-corrupt-*.pjt" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime | Select-Object -First 1
if (-not $original) {
    $original = Get-Item (Join-Path $bak "$Stem.pjt") -ErrorAction SilentlyContinue
}
if ($original) {
    Copy-Item $original.FullName $Pjt -Force
    Write-Host "OK restaurado $Pjt desde $($original.Name)" -ForegroundColor Green
} elseif (-not (Test-Path $Pjt)) {
    throw "Falta $Pjt - re-decompila ExportZ o copia backup_pjx\$Stem.pjt"
}

foreach ($ghost in @("mscomctl.pjx", "mscomctl.pjt")) {
    $g = Join-Path $ExportRoot $ghost
    if (Test-Path $g) {
        Copy-Item $g (Join-Path $bak "mscomctl-export-$stamp.$($ghost.Split('.')[-1])") -Force
        Remove-Item $g -Force
        Write-Host "OK cuarentena $ghost" -ForegroundColor Yellow
    }
}

python (Join-Path $RepoRoot "scripts\repair_exportz_lfn.py") $ExportRoot "$Stem.lfn"

$vfpRepo = Join-Path $RepoRoot "vfp"
foreach ($f in @(
    "suite_repair_lib.prg", "RepararProyectoSilent.prg", "RepairExportzFromLfn.prg",
    "export_build_stubs.prg", "suite_cola_sync.prg", "suite_control_sync.prg"
)) {
    Copy-Item (Join-Path $vfpRepo $f) (Join-Path $ExportRoot "PROGS\$f") -Force
}

Set-Content -Path (Join-Path $ExportRoot "suite_project.cfg") -Value $Stem -Encoding ASCII -NoNewline

$projPath = Join-Path $ExportRoot $Stem
Write-Host ""
Write-Host "IMPORTANTE: NO ejecutes RepararProyectoSilent si el .pjt da error." -ForegroundColor Yellow
Write-Host "Usa este flujo en VFP9:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  A) Proyecto nuevo (recomendado si memo invalid):"
Write-Host "     1. File - New - Project - $Stem  en  $ExportRoot"
Write-Host "     2. DO PROGS\RepairExportzFromLfn.prg"
Write-Host "     3. File - Save"
Write-Host ""
Write-Host "  B) Abrir proyecto existente:"
Write-Host "     1. File - Open Project - $projPath"
Write-Host "     2. Locate File: Ignore All"
Write-Host "     3. DO PROGS\RepairExportzFromLfn.prg  (no RepararProyectoSilent)"
Write-Host "     4. File - Save"
Write-Host ""
Write-Host "  Build: BUILD EXE Duna.exe FROM $Stem RECOMPILE  (VFP9 IDE)"
