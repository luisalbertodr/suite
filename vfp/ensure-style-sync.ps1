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

function Read-SuiteSyncAgentCfg {
    param([string]$Root)
    $cfg = @{ AGENT_DIR = ""; NODE_EXE = "" }
    $cfgPath = Join-Path $Root "SuiteSyncAgent.cfg"
    if (-not (Test-Path $cfgPath)) { return $cfg }
    foreach ($line in Get-Content $cfgPath -ErrorAction SilentlyContinue) {
        if ($line -match '^\s*AGENT_DIR\s*=\s*(.+)\s*$') {
            $cfg.AGENT_DIR = $Matches[1].Trim().Trim('"')
        }
        if ($line -match '^\s*NODE_EXE\s*=\s*(.+)\s*$') {
            $cfg.NODE_EXE = $Matches[1].Trim().Trim('"')
        }
    }
    return $cfg
}

function Read-AgentDirFromCfg {
    param([string]$Root, [string]$Override)
    if ($Override) { return [IO.Path]::GetFullPath($Override) }
    $envDir = $env:STYLE_SYNC_AGENT_DIR
    if ($envDir -and (Test-Path $envDir)) { return [IO.Path]::GetFullPath($envDir) }
    $cfg = Read-SuiteSyncAgentCfg -Root $Root
    if ($cfg.AGENT_DIR -and (Test-Path $cfg.AGENT_DIR)) { return [IO.Path]::GetFullPath($cfg.AGENT_DIR) }
    $local = Join-Path $Root "style-sync-agent"
    if (Test-Path (Join-Path $local "dist\index.js")) { return $local }
    $repo = "C:\Users\OportoW11\Suite\suite\style-sync-agent"
    if (Test-Path (Join-Path $repo "dist\index.js")) { return $repo }
    return $null
}

function Resolve-NodeExe {
    param([string]$Root, [string]$AgentDirPath)
    $candidates = @()
    $cfg = Read-SuiteSyncAgentCfg -Root $Root
    if ($cfg.NODE_EXE) { $candidates += $cfg.NODE_EXE }
    if ($env:NODE_EXE) { $candidates += $env:NODE_EXE }
    if ($AgentDirPath) {
        $candidates += (Join-Path $AgentDirPath "runtime\node.exe")
    }
    $candidates += @(
        "C:\Program Files\nodejs\node.exe",
        "C:\Program Files (x86)\nodejs\node.exe"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return [IO.Path]::GetFullPath($c) }
    }
    $where = (Get-Command node -ErrorAction SilentlyContinue).Source
    if ($where -and (Test-Path $where)) { return [IO.Path]::GetFullPath($where) }
    return $null
}

function Test-StyleSyncAgentRunning {
    Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'dist[/\\]index\.js' } |
        Select-Object -First 1
}

function Ensure-StyleSyncAgentFiles {
    param([string]$AgentDirPath, [string]$Root, [string]$NodeExe)
    $runner = Join-Path $Root "run_style_sync_agent.bat"
    $vbs = Join-Path $Root "run_style_sync_agent_hidden.vbs"
    @"
@echo off
cd /d "$AgentDirPath"
powershell -NoProfile -Command "`$p=Get-CimInstance Win32_Process -Filter \"name='node.exe'\" -EA SilentlyContinue | Where-Object { `$_.CommandLine -match 'dist[/\\]index\.js' } | Select-Object -First 1; if(`$p){exit 0}else{exit 1}"
if %ERRORLEVEL%==0 exit /b 0
start /B "" "$NodeExe" dist/index.js >> agent-run.log 2>&1
"@ | Set-Content -Path $runner -Encoding ASCII
    @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$AgentDirPath"
sh.Run Chr(34) & "$runner" & Chr(34), 0, False
"@ | Set-Content -Path $vbs -Encoding ASCII
}

function Start-StyleSyncAgent {
    param([string]$AgentDirPath, [string]$Root)
    $restartFlag = Join-Path $Root "Usuarios\_suite_restart_agent.req"
    $needRestart = Test-Path $restartFlag
    if ($needRestart -and (Test-StyleSyncAgentRunning)) {
        Write-SyncLog "reinicio agente solicitado (_suite_restart_agent.req)"
        Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match 'dist[/\\]index\.js' } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 2
        Remove-Item $restartFlag -Force -ErrorAction SilentlyContinue
    }
    if (Test-StyleSyncAgentRunning) {
        Write-SyncLog "agente Node ya en ejecucion"
        return $true
    }
    if (-not (Test-Path (Join-Path $AgentDirPath "dist\index.js"))) {
        Write-SyncLog "AVISO: no existe $AgentDirPath\dist\index.js - ejecuta npm run build en style-sync-agent"
        return $false
    }
    $nodeExe = Resolve-NodeExe -Root $Root -AgentDirPath $AgentDirPath
    if (-not $nodeExe) {
        Write-SyncLog "AVISO: no se encuentra node.exe - instala Node o copia runtime a $AgentDirPath\runtime\node.exe"
        return $false
    }
    Ensure-StyleSyncAgentFiles -AgentDirPath $AgentDirPath -Root $Root -NodeExe $nodeExe
    $vbs = Join-Path $Root "run_style_sync_agent_hidden.vbs"
    Start-Process wscript.exe -ArgumentList "`"$vbs`"" -WindowStyle Hidden
    Start-Sleep -Seconds 4
    $ok = [bool](Test-StyleSyncAgentRunning)
    if (-not $ok) {
        Start-Process -FilePath $nodeExe -ArgumentList "dist/index.js" -WorkingDirectory $AgentDirPath -WindowStyle Hidden | Out-Null
        Start-Sleep -Seconds 2
        $ok = [bool](Test-StyleSyncAgentRunning)
    }
    Write-SyncLog $(if ($ok) { "agente Node iniciado ($nodeExe)" } else { "AVISO: agente Node no arranco ($nodeExe)" })
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
