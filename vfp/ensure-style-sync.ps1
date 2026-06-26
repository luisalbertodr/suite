# Arranque y recuperación Style <-> Suite (agente Node + worker inbound VFP).
# Llamado desde IniciarStyle.bat y desde suite_boot_sync.prg (Duna.exe).
#
# Uso:
#   .\ensure-style-sync.ps1 -StyleRoot "C:\Duna\Style-Suite-Test" -EnsureAgent
#   .\ensure-style-sync.ps1 -StyleRoot "..." -DrainInboundBeforeStart
#   .\ensure-style-sync.ps1 -StyleRoot "..." -DrainInboundAfterShutdown
#   .\ensure-style-sync.ps1 -StyleRoot "..." -RecoverInboundLock [-ForceRecover]
#
param(
    [Parameter(Mandatory = $true)]
    [string]$StyleRoot,
    [switch]$EnsureAgent,
    [switch]$DrainInboundBeforeStart,
    [switch]$DrainInboundAfterShutdown,
    [switch]$RecoverInboundLock,
    [switch]$ForceRecover,
    [string]$AgentDir = "",
    [int]$HeartbeatStaleSec = 120,
    [int]$WorkerWaitSec = 45
)

$ErrorActionPreference = "Continue"
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))

function Write-SyncLog([string]$Msg) {
    $logDir = Join-Path $StyleRoot "Usuarios"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Msg"
    Add-Content -Path (Join-Path $logDir "_suite_sync_boot.log") -Value $line -Encoding UTF8
    Write-Host $line
}

function Read-AgentDirFromCfg {
    param([string]$Root, [string]$Override)
    if ($Override) { return [IO.Path]::GetFullPath($Override) }
    $envDir = $env:STYLE_SYNC_AGENT_DIR
    if ($envDir -and (Test-Path $envDir)) { return [IO.Path]::GetFullPath($envDir) }
    $cfg = Join-Path $Root "SuiteSyncAgent.cfg"
    if (Test-Path $cfg) {
        foreach ($line in Get-Content $cfg -ErrorAction SilentlyContinue) {
            if ($line -match '^\s*AGENT_DIR\s*=\s*(.+)\s*$') {
                $p = $Matches[1].Trim().Trim('"')
                if ($p -and (Test-Path $p)) { return [IO.Path]::GetFullPath($p) }
            }
        }
    }
    $local = Join-Path $Root "style-sync-agent"
    if (Test-Path (Join-Path $local "dist\index.js")) { return $local }
    $repo = "C:\Users\OportoW11\Suite\suite\style-sync-agent"
    if (Test-Path (Join-Path $repo "dist\index.js")) { return $repo }
    return $null
}

function Test-StyleSyncAgentRunning {
    Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'dist[/\\]index\.js' } |
        Select-Object -First 1
}

function Ensure-StyleSyncAgentFiles {
    param([string]$AgentDirPath, [string]$Root)
    $runner = Join-Path $Root "run_style_sync_agent.bat"
    $vbs = Join-Path $Root "run_style_sync_agent_hidden.vbs"
    if (-not (Test-Path $runner)) {
        @"
@echo off
cd /d "$AgentDirPath"
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /I "PID:"') do (
  powershell -NoProfile -Command "if((Get-CimInstance Win32_Process -Filter 'ProcessId=%%i').CommandLine -match 'dist[/\\]index\.js'){exit 0}" && exit /b 0
)
start /B node dist/index.js >> agent-run.log 2>&1
"@ | Set-Content -Path $runner -Encoding ASCII
    }
    if (-not (Test-Path $vbs)) {
        @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$AgentDirPath"
sh.Run Chr(34) & "$runner" & Chr(34), 0, False
"@ | Set-Content -Path $vbs -Encoding ASCII
    }
}

function Start-StyleSyncAgent {
    param([string]$AgentDirPath, [string]$Root)
    if (Test-StyleSyncAgentRunning) {
        Write-SyncLog "agente Node ya en ejecucion"
        return $true
    }
    if (-not (Test-Path (Join-Path $AgentDirPath "dist\index.js"))) {
        Write-SyncLog "AVISO: no existe $AgentDirPath\dist\index.js - ejecuta npm run build en style-sync-agent"
        return $false
    }
    Ensure-StyleSyncAgentFiles -AgentDirPath $AgentDirPath -Root $Root
    $vbs = Join-Path $Root "run_style_sync_agent_hidden.vbs"
    Start-Process wscript.exe -ArgumentList "`"$vbs`"" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $ok = [bool](Test-StyleSyncAgentRunning)
    Write-SyncLog $(if ($ok) { "agente Node iniciado" } else { "AVISO: agente Node no arranco" })
    return $ok
}

function Get-PendingInboundJsonCount {
    $inbound = Join-Path $StyleRoot "sync\inbound"
    if (-not (Test-Path $inbound)) { return 0 }
    return @(Get-ChildItem $inbound -Filter "*.json" -ErrorAction SilentlyContinue).Count
}

function Test-DunaRunning {
    $names = @("Duna.exe", "Duna2.exe", "mscomctl.exe", "vfp9.exe")
    foreach ($n in $names) {
        if (Get-Process -Name ($n -replace '\.exe$','') -ErrorAction SilentlyContinue) { return $true }
    }
    return $false
}

function Test-RecentInboundWedbErrors {
    param([int]$TailLines = 40)
    $log = Join-Path $StyleRoot "sync\inbound_worker.log"
    if (-not (Test-Path $log)) { return $false }
    $tail = Get-Content $log -Tail $TailLines -ErrorAction SilentlyContinue
    return ($tail -match 'wedb\.dbc.*(access denied|denegado)|wedb SHARED fail')
}

function Invoke-InboundWorker {
    param([int]$WaitSec = 45)
    $vbs = Join-Path $StyleRoot "run_inbound_worker_hidden.vbs"
    if (-not (Test-Path $vbs)) {
        Write-SyncLog "AVISO: falta run_inbound_worker_hidden.vbs - install-style-inbound-scheduler.ps1"
        return $false
    }
    Write-SyncLog "lanzando worker inbound (espera ${WaitSec}s)..."
    Start-Process wscript.exe -ArgumentList "`"$vbs`"" -WindowStyle Hidden -Wait
    Start-Sleep -Seconds 2
    $pending = Get-PendingInboundJsonCount
    $wedbErr = Test-RecentInboundWedbErrors
    $ok = ($pending -eq 0) -or (-not $wedbErr)
    Write-SyncLog "worker inbound: pending_json=$pending wedb_error=$wedbErr ok=$ok"
    return $ok
}

function Drain-InboundIfNeeded {
    param([string]$Reason, [switch]$AllowWhileDunaOpen)
    $pending = Get-PendingInboundJsonCount
    if ($pending -le 0) {
        Write-SyncLog "$Reason - sin JSON inbound pendiente"
        return $true
    }
    if ((Test-DunaRunning) -and -not $AllowWhileDunaOpen) {
        Write-SyncLog "$Reason - $pending JSON pendiente pero Duna abierto (omitido; cerrar Style o RecuperarSyncInbound.bat)"
        return $false
    }
    Write-SyncLog "$Reason - $pending JSON pendiente, drenando..."
    return Invoke-InboundWorker -WaitSec $WorkerWaitSec
}

# --- main ---
$resolvedAgentDir = Read-AgentDirFromCfg -Root $StyleRoot -Override $AgentDir

if ($EnsureAgent) {
    if (-not $resolvedAgentDir) {
        Write-SyncLog "EnsureAgent: sin AGENT_DIR (crea SuiteSyncAgent.cfg desde SuiteSyncAgent.cfg.example)"
    } else {
        Start-StyleSyncAgent -AgentDirPath $resolvedAgentDir -Root $StyleRoot | Out-Null
    }
}

if ($DrainInboundBeforeStart) {
    Drain-InboundIfNeeded -Reason "pre-arranque Duna" | Out-Null
}

if ($DrainInboundAfterShutdown) {
    Drain-InboundIfNeeded -Reason "post-cierre Duna" | Out-Null
}

if ($RecoverInboundLock) {
    $pending = Get-PendingInboundJsonCount
    $wedbErr = Test-RecentInboundWedbErrors
    if ($pending -le 0) {
        Write-SyncLog "Recover: nada que recuperar"
        exit 0
    }
    if (-not $wedbErr -and -not $ForceRecover) {
        Write-SyncLog "Recover: $pending JSON pero sin error wedb reciente - solo worker normal"
        Invoke-InboundWorker | Out-Null
        exit 0
    }
    if ((Test-DunaRunning) -and $ForceRecover) {
        Write-SyncLog "Recover FORCE: cerrando Duna.exe para desbloquear wedb..."
        Get-Process -Name "Duna","Duna2","mscomctl" -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 3
    } elseif ((Test-DunaRunning) -and -not $ForceRecover) {
        Write-SyncLog "Recover: wedb bloqueado con Duna abierto - usa RecuperarSyncInbound.bat"
        exit 1
    }
    $ok = Invoke-InboundWorker -WaitSec ($WorkerWaitSec + 15)
    exit $(if ($ok) { 0 } else { 1 })
}

if (-not ($EnsureAgent -or $DrainInboundBeforeStart -or $DrainInboundAfterShutdown -or $RecoverInboundLock)) {
    Write-SyncLog 'Sin accion (usa -EnsureAgent o -DrainInboundBeforeStart)'
}
