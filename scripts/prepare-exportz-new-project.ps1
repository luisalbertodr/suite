# Cuarentena mscomctlOk.pjx/.pjt corruptos para crear proyecto limpio en VFP9.
# Uso (VFP cerrado): .\scripts\prepare-exportz-new-project.ps1
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$Stem = "mscomctlOk"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))
$bak = Join-Path $ExportRoot "backup_pjx"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $bak "before-new-$stamp"

Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

New-Item -ItemType Directory -Path $dest -Force | Out-Null
$moved = 0
foreach ($ext in @("pjx", "pjt", "ERR")) {
    $p = Join-Path $ExportRoot "$Stem.$ext"
    if (Test-Path $p) {
        Move-Item $p (Join-Path $dest "$Stem.$ext") -Force
        Write-Host "OK movido $Stem.$ext -> $dest" -ForegroundColor Yellow
        $moved++
    }
}
if ($moved -eq 0) {
    Write-Host "No habia $Stem.pjx/.pjt en $ExportRoot (ya limpio)" -ForegroundColor Green
}

# Sin .pjx aun (proyecto nuevo en VFP). Solo lista LFN + PRGs de repair.
foreach ($ghost in @("mscomctl.pjx", "mscomctl.pjt")) {
    $g = Join-Path $ExportRoot $ghost
    if (Test-Path $g) {
        Copy-Item $g (Join-Path $bak "mscomctl-export-$stamp.$($ghost.Split('.')[-1])") -Force
        Remove-Item $g -Force
        Write-Host "OK cuarentena $ghost" -ForegroundColor Yellow
    }
}

$lfn = Join-Path $ExportRoot "$Stem.lfn"
if (-not (Test-Path $lfn)) {
    throw "Falta $lfn - no se puede generar repair_project_files.txt"
}
python (Join-Path $RepoRoot "scripts\repair_exportz_lfn.py") $ExportRoot "$Stem.lfn"

$vfpRepo = Join-Path $RepoRoot "vfp"
$progs = Join-Path $ExportRoot "PROGS"
foreach ($f in @(
    "suite_repair_lib.prg", "RepararProyectoSilent.prg", "RepairExportzFromLfn.prg",
    "export_build_stubs.prg", "suite_cola_sync.prg", "suite_control_sync.prg",
    "general.prg", "funciones.prg"
)) {
    Copy-Item (Join-Path $vfpRepo $f) (Join-Path $progs $f) -Force
}
Write-Host "OK PRGs de repair/sync en ExportZ\PROGS" -ForegroundColor Green

Set-Content -Path (Join-Path $ExportRoot "suite_project.cfg") -Value $Stem -Encoding ASCII -NoNewline
Write-Host "OK suite_project.cfg -> $Stem" -ForegroundColor Green

Write-Host ""
Write-Host "Siguiente en VFP9:" -ForegroundColor Cyan
Write-Host "  1. File > New > Project > $Stem  en  $ExportRoot"
Write-Host "  2. File > Save"
Write-Host "  3. SET DEFAULT TO $ExportRoot"
Write-Host "  4. DO PROGS\RepairExportzFromLfn.prg"
Write-Host "  5. File > Save  (espera ~1200 archivos en el PM)"
