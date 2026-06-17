# Copia configuracion de empresa/registro desde Style produccion (Z:) al entorno de prueba.
# Corrige: idioma cada arranque, menus, aniversarios (cfg en EMPRESA.FPT).
#
# Uso:
#   .\scripts\sync-style-config-from-z.ps1
#   .\scripts\sync-style-config-from-z.ps1 -DestRoot 'C:\Duna\Style-Suite-Test'

param(
    [string]$SourceRoot = "Z:\Style-Dunasoft",
    [string]$DestRoot = "C:\Duna\Style-Suite-Test"
)

$ErrorActionPreference = "Stop"
$SourceRoot = [IO.Path]::GetFullPath($SourceRoot.TrimEnd('\'))
$DestRoot = [IO.Path]::GetFullPath($DestRoot.TrimEnd('\'))

if (-not (Test-Path $SourceRoot)) {
    throw "No accesible: $SourceRoot (monta Z:\Style-Dunasoft)"
}

Write-Host "=== sync-style-config-from-z ===" -ForegroundColor Cyan
Write-Host "Origen:  $SourceRoot"
Write-Host "Destino: $DestRoot"

$files = @(
    "EMPRESA.DBF",
    "EMPRESA.FPT",
    "errorswe.txt",
    "version.bmp"
)

foreach ($f in $files) {
    $src = Join-Path $SourceRoot $f
    if (-not (Test-Path $src)) {
        Write-Host "  omitido (no existe en origen): $f" -ForegroundColor DarkGray
        continue
    }
    $bak = Join-Path $DestRoot ($f + ".bak-" + (Get-Date -Format "yyyyMMdd"))
    $dst = Join-Path $DestRoot $f
    if (Test-Path $dst) {
        Copy-Item $dst $bak -Force
        Write-Host "  backup: $bak" -ForegroundColor DarkGray
    }
    Copy-Item $src $dst -Force
    $sz = (Get-Item $dst).Length
    Write-Host "  OK $f ($sz bytes)" -ForegroundColor Green
}

# config.fpw con ruta destino
$fpw = Join-Path $DestRoot "config.fpw"
@"
* VFP: directorio de trabajo = raiz Style
DEFAULT=$DestRoot
RESOURCE=OFF
MVCOUNT=4096
"@ | Set-Content $fpw -Encoding ASCII
Write-Host "  OK config.fpw DEFAULT=$DestRoot" -ForegroundColor Green

Write-Host ""
Write-Host "Reinicia Style con IniciarStyle.bat" -ForegroundColor Cyan
