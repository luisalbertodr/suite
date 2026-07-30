# Cierra Duna2.exe en todas las sesiones y lanza sync hard (ventana nocturna).
# Uso:
#   .\close-duna2-nightly.ps1
#   .\close-duna2-nightly.ps1 -StyleRoot "C:\Style-Dunasoft" -DrainInbound -TriggerHardSync
param(
    [string]$StyleRoot = "",
    [switch]$DrainInbound,
    [switch]$TriggerHardSync
)

$ErrorActionPreference = "Continue"

# Por defecto en tarea programada: drenar inbound y lanzar hard sync tras cierre.
if (-not $PSBoundParameters.ContainsKey('DrainInbound')) { $DrainInbound = $true }
if (-not $PSBoundParameters.ContainsKey('TriggerHardSync')) { $TriggerHardSync = $true }

function Resolve-StyleRoot {
    param([string]$Override)
    if ($Override) { return $Override.TrimEnd('\') }
    $envRoot = $env:STYLE_HOME
    if ($envRoot) { return $envRoot.TrimEnd('\') }
    return (Split-Path -Parent $MyInvocation.MyCommand.Path).TrimEnd('\')
}

function Write-CloseLog {
    param([string]$Root, [string]$Message)
    $logDir = Join-Path $Root "sync"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    }
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path (Join-Path $logDir "close_duna2_nightly.log") -Value $line -Encoding UTF8
}

function Test-Duna2Running {
    try {
        return [bool](Get-CimInstance Win32_Process -Filter "Name='Duna2.exe'" -ErrorAction SilentlyContinue)
    } catch {
        return $false
    }
}

$root = Resolve-StyleRoot -Override $StyleRoot
Write-CloseLog -Root $root -Message "inicio cierre Duna2.exe (todas las sesiones)"

$targets = @()
try {
    $targets = @(Get-CimInstance Win32_Process -Filter "Name='Duna2.exe'" -ErrorAction Stop)
} catch {
    Write-CloseLog -Root $root -Message "AVISO: no se pudo enumerar procesos ($($_.Exception.Message))"
}

$closed = 0
foreach ($proc in $targets) {
    $pid = [int]$proc.ProcessId
    $session = [int]$proc.SessionId
    try {
        Stop-Process -Id $pid -Force -ErrorAction Stop
        $closed++
        Write-CloseLog -Root $root -Message "cerrado pid=$pid session=$session"
    } catch {
        Write-CloseLog -Root $root -Message "fallo pid=$pid session=$session: $($_.Exception.Message)"
    }
}

# Respaldo: taskkill como SYSTEM alcanza el resto de sesiones.
$null = & taskkill.exe /F /IM Duna2.exe /T 2>&1
Start-Sleep -Seconds 2

$duna2Open = Test-Duna2Running
if (-not $duna2Open) {
    Write-CloseLog -Root $root -Message "fin ok (cerrados=$closed, Duna2.exe no activo)"
} else {
    Write-CloseLog -Root $root -Message "fin con Duna2.exe aún activo tras cierre"
}

$ensure = Join-Path $root "ensure-style-sync.ps1"
if ($DrainInbound -and -not $duna2Open -and (Test-Path $ensure)) {
    Write-CloseLog -Root $root -Message "drenando inbound tras cierre..."
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden `
        -File $ensure -StyleRoot $root -DrainInboundAfterShutdown | Out-Null
} elseif ($DrainInbound -and $duna2Open) {
    Write-CloseLog -Root $root -Message "omitido drenaje inbound (Duna2.exe sigue abierto)"
}

if ($TriggerHardSync) {
    if ($duna2Open) {
        Write-CloseLog -Root $root -Message "omitido hard sync (Duna2.exe sigue abierto)"
        exit 1
    }
    if (-not (Test-Path $ensure)) {
        Write-CloseLog -Root $root -Message "AVISO: falta ensure-style-sync.ps1 (sin hard sync)"
        exit 1
    }
    Write-CloseLog -Root $root -Message "iniciando hard sync..."
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden `
        -File $ensure -StyleRoot $root -TriggerHardSync
    $hardExit = $LASTEXITCODE
    Write-CloseLog -Root $root -Message $(if ($hardExit -eq 0) { "hard sync fin ok" } else { "hard sync fin con errores (exit=$hardExit)" })
    exit $hardExit
}

exit $(if ($duna2Open) { 1 } else { 0 })
