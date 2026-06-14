# Copia PRGs del repo a C:\Duna\Export\PROGS\ antes del BUILD VFP9.
# general.prg y funciones.prg se editan en Export; este script sincroniza suite_full_unlock.prg.
#
# Uso:
#   .\scripts\sync-vfp-export.ps1
#   .\scripts\sync-vfp-export.ps1 -ExportRoot 'D:\Duna\Export'

param(
    [string]$ExportRoot = "C:\Duna\Export"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpRepo = Join-Path $RepoRoot "vfp"
$Progs = Join-Path $ExportRoot "PROGS"

if (-not (Test-Path $Progs)) {
    throw "No existe $Progs. Ajusta -ExportRoot."
}

$copy = @(
    @{ Src = "suite_full_unlock.prg"; Dst = "suite_full_unlock.prg" }
)

foreach ($item in $copy) {
    $src = Join-Path $VfpRepo $item.Src
    $dst = Join-Path $Progs $item.Dst
    if (-not (Test-Path $src)) { throw "Falta $src" }
    Copy-Item $src $dst -Force
    $fi = Get-Item $dst
    Write-Host ("OK  {0}  {1} bytes" -f $item.Dst, $fi.Length) -ForegroundColor Green
}

Write-Host @"

Parches de arranque (idioma, aniversarios, sin .bat) estan en:
  $Progs\general.prg
  $Progs\funciones.prg
Edita ahi o en el repo vfp\patches\*.txt (referencia).

Build VFP9:
  cd $ExportRoot
  BUILD-DUNA.bat
  (o en VFP: DO PROGS\VfpBuildProject.prg)

Despliegue VM:
  .\scripts\deploy-duna-exe-vm.ps1

"@ -ForegroundColor Cyan
