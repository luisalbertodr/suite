# Wrapper repo: copia scripts a StyleRoot e instala tarea programada.
#
# En la VM de producción (ejecutar aquí, PowerShell como administrador):
#   .\scripts\install-style-close-duna2-scheduler.ps1
#   .\scripts\install-style-close-duna2-scheduler.ps1 -StyleRoot "C:\Style-Dunasoft"
#
# Desde PC de desarrollo (copia por SMB + schtasks remoto, sin WinRM):
#   .\scripts\install-style-close-duna2-scheduler.ps1 -VmHost "192.168.99.16"
#
param(
    [string]$StyleRoot = "",
    [string]$TaskName = "SuiteStyleCloseDuna2Nightly",
    [string]$DailyAt = "01:00",
    [string]$VmHost = "",
    [switch]$NoDrainInbound,
    [switch]$NoHardSync
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Vfp = Join-Path $RepoRoot "vfp"
$ProdStyleRoot = "C:\Style-Dunasoft"

function Test-IsLocalMachine {
    param([string]$HostOrIp)
    if (-not $HostOrIp) { return $true }
    $target = $HostOrIp.Trim().ToLowerInvariant()
    $aliases = New-Object System.Collections.Generic.HashSet[string]
    [void]$aliases.Add($target)
    [void]$aliases.Add($env:COMPUTERNAME.ToLowerInvariant())
    try {
        [void]$aliases.Add([System.Net.Dns]::GetHostName().ToLowerInvariant())
        foreach ($a in [System.Net.Dns]::GetHostAddresses($env:COMPUTERNAME)) {
            [void]$aliases.Add($a.IPAddressToString.ToLowerInvariant())
        }
    } catch { }
    try {
        foreach ($a in [System.Net.Dns]::GetHostAddresses($target)) {
            if ($aliases.Contains($a.IPAddressToString.ToLowerInvariant())) { return $true }
        }
    } catch { }
    return $aliases.Contains($target)
}

# --- Resolver rutas ---
$installLocal = $true
$copyRoot = $ProdStyleRoot
$invokeRoot = $ProdStyleRoot

if ($VmHost -and -not (Test-IsLocalMachine $VmHost)) {
    $installLocal = $false
    $copyRoot = "\\$VmHost\c$\Style-Dunasoft"
    $invokeRoot = $ProdStyleRoot
    Write-Host "Destino remoto: $copyRoot (tarea en $invokeRoot)" -ForegroundColor Cyan
} else {
    if ($VmHost) {
        Write-Host "VM local detectada ($VmHost) — sin WinRM ni IP remota" -ForegroundColor Cyan
    }
    if ($StyleRoot) {
        $copyRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))
    } elseif (Test-Path $ProdStyleRoot) {
        $copyRoot = $ProdStyleRoot
    } else {
        $copyRoot = [IO.Path]::GetFullPath("C:\Duna\Style-Suite-Test")
    }
    $invokeRoot = $copyRoot
}

$copyRoot = [IO.Path]::GetFullPath($copyRoot.TrimEnd('\'))

foreach ($f in @("close-duna2-nightly.ps1", "install-style-close-duna2-scheduler.ps1", "InstalarCierreDuna2Nightly.bat")) {
    $src = Join-Path $Vfp $f
    if (-not (Test-Path $src)) { throw "Falta $src" }
    Copy-Item $src (Join-Path $copyRoot $f) -Force
    Write-Host "  OK $f -> $copyRoot" -ForegroundColor Green
}

$drainArg = if ($NoDrainInbound) { "" } else { " -DrainInbound" }
$hardArg = if ($NoHardSync) { "" } else { " -TriggerHardSync" }
$nightlyScript = Join-Path $invokeRoot "close-duna2-nightly.ps1"
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$nightlyScript`" -StyleRoot `"$invokeRoot`"$drainArg$hardArg"
$tr = "powershell.exe $psArgs"

if ($installLocal) {
    $installer = Join-Path $copyRoot "install-style-close-duna2-scheduler.ps1"
    $localArgs = @{
        StyleRoot      = $invokeRoot
        TaskName       = $TaskName
        DailyAt        = $DailyAt
        NoDrainInbound = $NoDrainInbound
        NoHardSync     = $NoHardSync
    }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer @localArgs
    exit $LASTEXITCODE
}

# Remoto: schtasks (no requiere WinRM)
schtasks /Delete /S $VmHost /TN $TaskName /F 2>$null | Out-Null
$code = schtasks /Create /S $VmHost /TN $TaskName /TR $tr /SC DAILY /ST $DailyAt /RU SYSTEM /RL HIGHEST /F 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK Task $TaskName en $VmHost (schtasks diaria $DailyAt)" -ForegroundColor Green
    Write-Host "Script: $nightlyScript" -ForegroundColor Cyan
} else {
    throw "No se pudo registrar $TaskName en $VmHost. Ejecuta en la VM: cd $ProdStyleRoot; .\install-style-close-duna2-scheduler.ps1`nDetalle: $code"
}
