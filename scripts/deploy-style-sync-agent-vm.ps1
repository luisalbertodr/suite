# Despliega style-sync-agent en la VM Windows de Style (lectura local de DBFs, sin CIFS).
# Detiene el contenedor Docker en suite-supabase para evitar doble agente.
#
# Uso:
#   .\scripts\deploy-style-sync-agent-vm.ps1
#   .\scripts\deploy-style-sync-agent-vm.ps1 -VmHost 192.168.99.16 -SkipBuild
#   .\scripts\deploy-style-sync-agent-vm.ps1 -KeepDockerAgent   # no parar contenedor 110

param(
    [string]$VmHost = "192.168.99.16",
    [string]$VmLocalRoot = "C:\Style-Dunasoft",
    [string]$CompanyId = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4",
    [string]$SshHost = "suite-supabase",
    [string]$AgentTaskName = "SuiteStyleSyncAgent",
    [switch]$SkipBuild,
    [switch]$KeepDockerAgent,
    [switch]$SkipRestart
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AgentDir = Join-Path $RepoRoot "style-sync-agent"
$StyleRemote = "\\$VmHost\c$\$($VmLocalRoot.TrimStart('C:\'))"
$AgentRemote = Join-Path $StyleRemote "style-sync-agent"
$Key = Join-Path $env:USERPROFILE ".ssh\suite_deploy"

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "=== $Msg ===" -ForegroundColor Cyan
}

if (-not (Test-Path $StyleRemote)) {
    throw "Sin acceso SMB a $StyleRemote. Monta \\$VmHost\c$ o Z:\Style-Dunasoft."
}

if (-not $SkipBuild) {
    Write-Step "npm run build"
    Push-Location $AgentDir
    npm run build
    Pop-Location
}

Write-Step "Copiar agente -> $AgentRemote"
New-Item -ItemType Directory -Force -Path $AgentRemote | Out-Null
$copyItems = @("dist", "package.json", "package-lock.json")
foreach ($item in $copyItems) {
    $src = Join-Path $AgentDir $item
    $dest = Join-Path $AgentRemote $item
    if (Test-Path $src) {
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
        Copy-Item $src $dest -Recurse -Force
        Write-Host "  OK $item" -ForegroundColor Green
    }
}

Write-Step "Dependencias npm (omit=dev)"
$npmRemote = Join-Path $AgentRemote "node_modules"
if (-not (Test-Path (Join-Path $npmRemote "dotenv"))) {
    Push-Location $AgentDir
    if (-not (Test-Path "node_modules")) { npm ci }
    Copy-Item (Join-Path $AgentDir "node_modules") $npmRemote -Recurse -Force
    Pop-Location
    Write-Host "  OK node_modules copiado" -ForegroundColor Green
} else {
    Write-Host "  -- node_modules ya existe en VM" -ForegroundColor DarkGray
}

Write-Step ".env produccion (VM local)"
$sr = ssh -i $Key $SshHost "docker exec supabase-edge-functions printenv SUPABASE_SERVICE_ROLE_KEY"
if (-not $sr) { throw "No se pudo leer SUPABASE_SERVICE_ROLE_KEY" }
$syncRoot = $VmLocalRoot.TrimEnd('\')
$envContent = @"
STYLE_ROOT=$syncRoot
SUPABASE_URL=https://supabase.lipoout.com
SUPABASE_SERVICE_ROLE_KEY=$sr
COMPANY_ID=$CompanyId
SYNC_EVENT_DRIVEN=1
SYNC_DEBOUNCE_MS=300
SYNC_POLL_FALLBACK_MS=120000
INBOUND_POLL_MS=3000
INBOUND_BATCH=50
INBOUND_WORKER_TRIGGER=1
INBOUND_WORKER_MIN_INTERVAL_MS=8000
INBOUND_DIR=$syncRoot\sync\inbound
INBOUND_ACK_DIR=$syncRoot\sync\inbound_ack
ARCHIVE_DIR=$syncRoot\sync\archive
DEADLETTER_DIR=$syncRoot\sync\deadletter
HEARTBEAT_PATH=$syncRoot\sync\heartbeat.txt
HEARTBEAT_CHECK_MS=60000
HEARTBEAT_STALE_MS=300000
OUTBOUND_MAX_RETRIES=5
INBOUND_ACK_MAX_RETRIES=5
ENTITY_POLL_MS=120000
ENTITY_BATCH=15
# Barrido DBF completo (clientes/faccab/…): solo cuando Style está cerrado.
# Durante horario de uso la cola_sincro basta para cambios en tiempo real.
DBF_ENTITY_POLL_ENABLED=1
STYLE_UI_PROCESS_NAMES=duna.exe,duna2.exe,mscomctl.exe,style.exe
"@
Set-Content -Path (Join-Path $AgentRemote ".env") -Value $envContent -Encoding UTF8
Write-Host "  OK .env ($syncRoot)" -ForegroundColor Green

Write-Step "SuiteSyncAgent.cfg + ensure-style-sync.ps1"
@"
AGENT_DIR=$syncRoot\style-sync-agent
NODE_EXE=$syncRoot\style-sync-agent\runtime\node.exe
"@ | Set-Content -Path (Join-Path $StyleRemote "SuiteSyncAgent.cfg") -Encoding ASCII
Copy-Item (Join-Path $RepoRoot "vfp\ensure-style-sync.ps1") (Join-Path $StyleRemote "ensure-style-sync.ps1") -Force
Copy-Item (Join-Path $RepoRoot "vfp\IniciarStyle.bat") (Join-Path $StyleRemote "IniciarStyle.bat") -Force

$restartBat = Join-Path $StyleRemote "restart_style_sync_agent.bat"
@"
@echo off
cd /d "$syncRoot\style-sync-agent"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" -EA SilentlyContinue | Where-Object { `$_.CommandLine -match 'dist[/\\]index\.js' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force -EA SilentlyContinue }"
timeout /t 2 /nobreak >nul
wscript.exe //B "$syncRoot\run_style_sync_agent_hidden.vbs"
"@ | Set-Content -Path $restartBat -Encoding ASCII

$nodeExe = "$syncRoot\style-sync-agent\runtime\node.exe"
$runner = Join-Path $StyleRemote "run_style_sync_agent.bat"
$vbs = Join-Path $StyleRemote "run_style_sync_agent_hidden.vbs"
@"
@echo off
cd /d "$syncRoot\style-sync-agent"
powershell -NoProfile -Command "`$p=Get-CimInstance Win32_Process -Filter \"name='node.exe'\" -EA SilentlyContinue | Where-Object { `$_.CommandLine -match 'dist[/\\]index\.js' } | Select-Object -First 1; if(`$p){exit 0}else{exit 1}"
if %ERRORLEVEL%==0 exit /b 0
start /B "" "$nodeExe" dist/index.js >> agent-run.log 2>&1
"@ | Set-Content -Path $runner -Encoding ASCII
@"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$syncRoot\style-sync-agent"
sh.Run Chr(34) & "$syncRoot\run_style_sync_agent.bat" & Chr(34), 0, False
"@ | Set-Content -Path $vbs -Encoding ASCII

Write-Step "Task Scheduler en VM ($AgentTaskName)"
schtasks /Delete /S $VmHost /TN $AgentTaskName /F 2>$null | Out-Null
$tr = "wscript.exe //B `"$syncRoot\run_style_sync_agent_hidden.vbs`""
schtasks /Create /S $VmHost /TN $AgentTaskName /TR $tr /SC ONLOGON /RU SYSTEM /RL HIGHEST /F 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    schtasks /Create /S $VmHost /TN $AgentTaskName /TR $tr /SC MINUTE /MO 5 /RU SYSTEM /F 2>&1 | Out-Null
}
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK Task $AgentTaskName en $VmHost" -ForegroundColor Green
} else {
    Write-Warning "No se pudo registrar $AgentTaskName. El agente arranca con IniciarStyle.bat."
}

if (-not $KeepDockerAgent) {
    Write-Step "Detener agente Docker en $SshHost (evitar doble sync + CIFS)"
    ssh -i $Key $SshHost "docker rm -f style-sync-agent 2>/dev/null || true; docker ps -a --filter name=style-sync-agent --format '{{.Names}} {{.Status}}' || true"
    Write-Host "  Contenedor style-sync-agent detenido" -ForegroundColor Green
}

if (-not $SkipRestart) {
    Write-Step "Reiniciar agente en VM ($VmHost)"
    $onceTask = "SuiteRestartSyncAgentOnce"
    schtasks /Delete /S $VmHost /TN $onceTask /F 2>$null | Out-Null
    $tr = "cmd.exe /c `"$syncRoot\restart_style_sync_agent.bat`""
    $st = (Get-Date).AddMinutes(1).ToString("HH:mm")
    schtasks /Create /S $VmHost /TN $onceTask /TR $tr /SC ONCE /ST $st /RU SYSTEM /F | Out-Null
    if ($LASTEXITCODE -eq 0) {
        schtasks /Run /S $VmHost /TN $onceTask | Out-Null
        Write-Host "  Tarea remota lanzada ($onceTask)" -ForegroundColor Green
    } else {
        Write-Warning "No se pudo lanzar tarea remota. En la VM ejecuta: $syncRoot\restart_style_sync_agent.bat"
    }
}

Write-Host ""
Write-Host "Agente VM desplegado en $VmLocalRoot\style-sync-agent" -ForegroundColor Green
Write-Host "Verifica en VM: Get-Content $VmLocalRoot\style-sync-agent\agent-run.log -Tail 20" -ForegroundColor Cyan
if (-not $KeepDockerAgent) {
    Write-Host "Docker 110: style-sync-agent detenido (solo VM activa)." -ForegroundColor Yellow
}
