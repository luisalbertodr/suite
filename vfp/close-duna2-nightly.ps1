# Cierra Duna2.exe en todas las sesiones (ventana de sync hard nocturna).
# Uso:
#   .\close-duna2-nightly.ps1
#   .\close-duna2-nightly.ps1 -StyleRoot "C:\Style-Dunasoft" -DrainInbound
param(
    [string]$StyleRoot = "",
    [switch]$DrainInbound
)

$ErrorActionPreference = "Continue"

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

$remaining = @()
try {
    $remaining = @(Get-CimInstance Win32_Process -Filter "Name='Duna2.exe'" -ErrorAction SilentlyContinue)
} catch { }

if ($remaining.Count -eq 0) {
    Write-CloseLog -Root $root -Message "fin ok (cerrados=$closed, ninguno activo)"
} else {
    Write-CloseLog -Root $root -Message "fin con $($remaining.Count) Duna2.exe aun activos tras cierre"
}

if ($DrainInbound) {
    $ensure = Join-Path $root "ensure-style-sync.ps1"
    if (Test-Path $ensure) {
        Write-CloseLog -Root $root -Message "drenando inbound tras cierre..."
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden `
            -File $ensure -StyleRoot $root -DrainInboundAfterShutdown | Out-Null
    } else {
        Write-CloseLog -Root $root -Message "AVISO: falta ensure-style-sync.ps1 (sin drenaje inbound)"
    }
}

exit $(if ($remaining.Count -eq 0) { 0 } else { 1 })
