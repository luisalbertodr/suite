# Verificacion binaria pre-cutover v1 -> v2 (ExportZ sin suite_full_unlock).
#
# Uso:
#   .\scripts\verify-style-cutover.ps1 -StyleRemote "\\192.168.99.16\c$\Style-Dunasoft"
#   .\scripts\verify-style-cutover.ps1 -NewExe "C:\Duna\Style-Suite-Test\Duna.exe" -Backup

param(
    [string]$StyleRemote = "",
    [string]$NewExe = "C:\Duna\ExportZ\Duna.exe",
    [switch]$Backup,
    [switch]$SkipAbortOnUnlockFound
)

$ErrorActionPreference = "Stop"

function Test-ExeContainsString {
    param([string]$Path, [string]$Needle)
    if (-not (Test-Path $Path)) { return $false }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $text = [System.Text.Encoding]::ASCII.GetString($bytes)
    return $text.Contains($Needle)
}

if ([string]::IsNullOrWhiteSpace($StyleRemote)) {
    if (Test-Path "Z:\Style-Dunasoft") { $StyleRemote = "Z:\Style-Dunasoft" }
    else { $StyleRemote = "\\192.168.99.16\c$\Style-Dunasoft" }
}

$prodExe = Join-Path $StyleRemote "Duna.exe"
$bakExe = Join-Path $StyleRemote "Duna.exe.v1.legacy.bak"

Write-Host "=== Verificacion cutover Style v2 ===" -ForegroundColor Cyan
Write-Host "Produccion: $prodExe"
Write-Host "Nuevo exe:  $NewExe"

if (-not (Test-Path $NewExe)) {
    throw "No existe nuevo exe: $NewExe"
}

if ($Backup -and (Test-Path $prodExe)) {
    Copy-Item $prodExe $bakExe -Force
    Write-Host "OK backup -> $bakExe" -ForegroundColor Green
}

$srcForV1Check = if (Test-Path $bakExe) { $bakExe } elseif (Test-Path $prodExe) { $prodExe } else { $null }
if ($srcForV1Check) {
    $hasUnlock = Test-ExeContainsString -Path $srcForV1Check -Needle "suite_full_unlock"
    Write-Host "Referencia v1 contiene suite_full_unlock: $hasUnlock"
}

$newHasUnlock = Test-ExeContainsString -Path $NewExe -Needle "suite_full_unlock"
$newHasCola = Test-ExeContainsString -Path $NewExe -Needle "SuiteEnqueuePlan2009"

Write-Host "Nuevo exe contiene suite_full_unlock: $newHasUnlock" -ForegroundColor $(if ($newHasUnlock) { "Red" } else { "Green" })
Write-Host "Nuevo exe contiene SuiteEnqueuePlan2009: $newHasCola" -ForegroundColor $(if ($newHasCola) { "Green" } else { "Yellow" })

$newFi = Get-Item $NewExe
Write-Host "Tamano nuevo: $([math]::Round($newFi.Length / 1MB, 2)) MB"

if ($newHasUnlock -and -not $SkipAbortOnUnlockFound) {
    throw "ABORTAR: el nuevo Duna.exe aun contiene suite_full_unlock. Rebuild ExportZ sin unlock HTTP."
}

Write-Host ""
Write-Host "Cutover binario OK para desplegar." -ForegroundColor Green
