# Restaura mscomctl.pjx sano en ExportZ desde C:\Duna\Export (proyecto ReFox intacto).
param(
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [string]$HealthyExport = "C:\Duna\Export",
    [string]$Stem = "mscomctl"
)
$ErrorActionPreference = "Stop"
Get-Process vfp9 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$bak = Join-Path $ExportRoot "backup_pjx"
New-Item -ItemType Directory -Path $bak -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($ext in @("pjx", "pjt")) {
    $dst = Join-Path $ExportRoot "$Stem.$ext"
    if (Test-Path $dst) {
        Copy-Item $dst (Join-Path $bak "$Stem-$stamp.$ext") -Force
    }
    $src = Join-Path $HealthyExport "$Stem.$ext"
    if (-not (Test-Path $src)) { throw "Falta $src" }
    Copy-Item $src $dst -Force
    Write-Host "OK $dst <- $src ($((Get-Item $dst).Length) bytes)"
}
Set-Content -Path (Join-Path $ExportRoot "suite_project.cfg") -Value $Stem -Encoding ASCII -NoNewline
Write-Host "OK suite_project.cfg = $Stem"
Write-Host "NOTA: el .pjx/.pjt es de C:\Duna\Export (home nativo)."
Write-Host "      NO abras/guardes mscomctl en ExportZ — corrompe el .PJT."
Write-Host "      Build en Export: .\scripts\prepare-export-native-build.ps1"
