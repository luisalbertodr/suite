# Verificación E2E operativa (sin UI): colas, agente, heartbeat, RPCs.
param(
    [string]$CompanyId = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4",
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [string]$VmHost = "192.168.99.16"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$fail = 0

function Test-Check([bool]$Ok, [string]$Msg) {
    if ($Ok) { Write-Host "  OK $Msg" -ForegroundColor Green }
    else { Write-Host "  FAIL $Msg" -ForegroundColor Red; $script:fail++ }
}

Write-Host ""
Write-Host "=== verify-style-sync-e2e ===" -ForegroundColor Cyan

function Write-SubStep([string]$Msg) {
    Write-Host ""
    Write-Host "--- $Msg ---" -ForegroundColor Cyan
}

Write-SubStep "1. Archivos locales test"
$roots = @($TestRoot, "\\$VmHost\c$\Style-Dunasoft")
foreach ($r in $roots) {
    if (-not (Test-Path $r)) { continue }
    Test-Check (Test-Path (Join-Path $r "PROGS\suite_cola_sync.prg")) "$r PROGS\suite_cola_sync.prg"
    Test-Check (Test-Path (Join-Path $r "PROGS\suite_inbound_worker.prg")) "$r PROGS\suite_inbound_worker.prg"
    Test-Check (Test-Path (Join-Path $r "sync\inbound")) "$r sync\inbound"
    $hb = Join-Path $r "sync\heartbeat.txt"
    if (Test-Path $hb) {
        $age = ((Get-Date) - (Get-Item $hb).LastWriteTime).TotalMinutes
        Test-Check ($age -lt 10) "$r heartbeat reciente (${age:N0} min)"
    } else {
        Write-Host "  INFO Sin heartbeat en $r (worker no ha corrido)" -ForegroundColor Yellow
    }
}

Write-SubStep "2. Postgres agent state + colas"
$migCheck = ssh -i "$env:USERPROFILE\.ssh\suite_deploy" suite-supabase @"
docker exec supabase-db psql -U supabase_admin -d postgres -t -A -c "
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='dunasoft' AND table_name='style_sync_agent_state'
);
"
"@
Test-Check ($migCheck.Trim() -eq 't') "Tabla dunasoft.style_sync_agent_state"

$stateSql = @"
SELECT row_to_json(s)::text FROM dunasoft.style_sync_agent_state s
WHERE company_id = '$CompanyId';
"@
$stateJson = ssh -i "$env:USERPROFILE\.ssh\suite_deploy" suite-supabase "docker exec supabase-db psql -U supabase_admin -d postgres -t -A -c `"$stateSql`""
if ($stateJson.Trim()) {
    Write-Host "  agent_state: $($stateJson.Trim())" -ForegroundColor DarkGray
    Test-Check $true "Fila style_sync_agent_state para empresa"
} else {
    Test-Check $false "Fila style_sync_agent_state para empresa"
}

$pending = ssh -i "$env:USERPROFILE\.ssh\suite_deploy" suite-supabase @"
docker exec supabase-db psql -U supabase_admin -d postgres -t -A -c "
SELECT count(*) FROM dunasoft.style_reservas_queue WHERE delivered_at IS NULL;
"
"@
Write-Host "  inbound queue pendiente: $($pending.Trim())" -ForegroundColor DarkGray

Write-SubStep "3. Contenedor agente"
$agentLog = ssh -i "$env:USERPROFILE\.ssh\suite_deploy" suite-supabase "docker logs --tail 5 style-sync-agent 2>&1" 2>$null
if ($agentLog) {
    Write-Host $agentLog -ForegroundColor DarkGray
    Test-Check ($agentLog -notmatch 'SyntaxError|FATAL') "Logs agente sin error fatal"
} else {
    Write-Host "  INFO Contenedor style-sync-agent no encontrado o sin logs" -ForegroundColor Yellow
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "E2E operativo OK ($fail fallos)" -ForegroundColor Green
    exit 0
}
Write-Host "E2E con $fail fallo(s) — revisar infra" -ForegroundColor Red
exit 1
