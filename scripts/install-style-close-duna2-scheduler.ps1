# Wrapper repo: copia scripts a StyleRoot e instala tarea (local o VM remota).
#
# Uso:
#   .\scripts\install-style-close-duna2-scheduler.ps1 -StyleRoot "C:\Style-Dunasoft"
#   .\scripts\install-style-close-duna2-scheduler.ps1 -VmHost "192.168.99.16"
#
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [string]$TaskName = "SuiteStyleCloseDuna2Nightly",
    [string]$DailyAt = "01:00",
    [string]$VmHost = "",
    [switch]$NoDrainInbound,
    [switch]$NoHardSync
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Vfp = Join-Path $RepoRoot "vfp"

$VmLocalRoot = "C:\Style-Dunasoft"
if ($VmHost) {
    $StyleRoot = "\\$VmHost\c$\Style-Dunasoft"
    $InvokeStyleRoot = $VmLocalRoot
} else {
    $InvokeStyleRoot = $StyleRoot
}
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))

foreach ($f in @("close-duna2-nightly.ps1", "install-style-close-duna2-scheduler.ps1", "InstalarCierreDuna2Nightly.bat")) {
    $src = Join-Path $Vfp $f
    if (-not (Test-Path $src)) { throw "Falta $src" }
    Copy-Item $src (Join-Path $StyleRoot $f) -Force
    Write-Host "  OK $f -> $StyleRoot" -ForegroundColor Green
}

$installer = Join-Path $Vfp "install-style-close-duna2-scheduler.ps1"
$args = @{
    StyleRoot     = $InvokeStyleRoot
    TaskName      = $TaskName
    DailyAt       = $DailyAt
    NoDrainInbound = $NoDrainInbound
    NoHardSync    = $NoHardSync
}

if ($VmHost) {
    $argList = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
        (Join-Path $InvokeStyleRoot "install-style-close-duna2-scheduler.ps1"),
        "-StyleRoot", $InvokeStyleRoot,
        "-TaskName", $TaskName,
        "-DailyAt", $DailyAt
    )
    if ($NoDrainInbound) { $argList += "-NoDrainInbound" }
    if ($NoHardSync) { $argList += "-NoHardSync" }
    Invoke-Command -ComputerName $VmHost -ScriptBlock {
        param($ArgList)
        & powershell.exe @ArgList
    } -ArgumentList (, $argList)
} else {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer @args
}
