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

# v1 embebido: clase HTTP + timer. general.prg v2 menciona el nombre en rutas; no usar solo esa cadena.
$v1EmbeddedNeedles = @(
    "embebido exe OK (suite_full_unlock en Duna.exe)",
    "BINDEVENT(_SCREEN.oSuiteSyncTimer",
    "NEWOBJECT(""licencias_unlock"""
)
$v2ColaNeedle = "suite_cola_sync embebido exe OK"

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
    $hasUnlock = $false
    foreach ($n in $v1EmbeddedNeedles) {
        if (Test-ExeContainsString -Path $srcForV1Check -Needle $n) { $hasUnlock = $true; break }
    }
    Write-Host "Referencia v1 embebe canal HTTP legacy: $hasUnlock"
}

$newHasV1Embed = $false
foreach ($n in $v1EmbeddedNeedles) {
    if (Test-ExeContainsString -Path $NewExe -Needle $n) { $newHasV1Embed = $true; break }
}
$newHasCola = Test-ExeContainsString -Path $NewExe -Needle "SuiteEnqueuePlan2009"
$newHasColaBoot = Test-ExeContainsString -Path $NewExe -Needle $v2ColaNeedle

Write-Host "Nuevo exe embebe v1 HTTP (unlock timer): $newHasV1Embed" -ForegroundColor $(if ($newHasV1Embed) { "Red" } else { "Green" })
Write-Host "Nuevo exe contiene SuiteEnqueuePlan2009: $newHasCola" -ForegroundColor $(if ($newHasCola) { "Green" } else { "Yellow" })
Write-Host "Nuevo exe mensaje BOOT-04 cola (funciones): $newHasColaBoot" -ForegroundColor $(if ($newHasColaBoot) { "Green" } else { "Yellow" })

$newFi = Get-Item $NewExe
Write-Host "Tamano nuevo: $([math]::Round($newFi.Length / 1MB, 2)) MB"

if ($newHasV1Embed -and -not $SkipAbortOnUnlockFound) {
    throw "ABORTAR: el nuevo Duna.exe aun embebe sync HTTP v1. Quita suite_full_unlock del .pjx y recompila."
}

Write-Host ""
Write-Host "Cutover binario OK para desplegar." -ForegroundColor Green
