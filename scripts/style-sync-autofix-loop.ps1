# Bucle de verificación y reparación Style <-> Suite (sin UI).
# Uso: .\scripts\style-sync-autofix-loop.ps1 [-MaxRounds 12] [-IntervalSec 30]
param(
    [string]$CompanyId = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4",
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [string]$AgentDir = "C:\Users\OportoW11\Suite\suite\style-sync-agent",
    [int]$MaxRounds = 12,
    [int]$IntervalSec = 30,
    [int]$TestIdPlan = 999999990
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$failLog = Join-Path $RepoRoot "tmp\style-sync-autofix.log"
New-Item -ItemType Directory -Force -Path (Split-Path $failLog) | Out-Null

function Log([string]$Msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Msg"
    Add-Content -Path $failLog -Value $line
    Write-Host $line
}

function Invoke-AgentNode([string]$Script) {
    Push-Location $AgentDir
    try { node -e $Script 2>&1 | Out-String } finally { Pop-Location }
}

function Ensure-AgentRunning {
    $procs = Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'dist[/\\]index\.js' }
    if ($procs) { return $true }
    Log "Reiniciando agente Node..."
    Push-Location $AgentDir
    npm run build 2>&1 | Out-Null
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c node dist/index.js >> agent-run.log 2>&1" -WorkingDirectory $AgentDir -WindowStyle Hidden
    Pop-Location
    Start-Sleep -Seconds 3
    return $true
}

function Test-Sql([string]$Sql) {
    $escaped = $Sql -replace '"', '\"'
    ssh -o ConnectTimeout=12 -i "$env:USERPROFILE\.ssh\suite_deploy" suite-supabase `
        "docker exec supabase-db psql -U supabase_admin -d postgres -t -A -c `"$escaped`"" 2>&1
}

function Repair-Codusu {
    $mig = Join-Path $RepoRoot "supabase\migrations\20260625130000_fix_resolve_dunasoft_codusu_v2.sql"
    if (Test-Path $mig) {
        Log "Aplicando migración resolve_dunasoft_codusu..."
        & (Join-Path $RepoRoot "scripts\deploy-migration.ps1") "20260625120000_fix_resolve_dunasoft_codusu.sql" 2>&1 | Out-Null
    }
}

function Test-Codusu {
    $r = Test-Sql "SELECT dunasoft.resolve_dunasoft_codusu('00000000-0000-0000-0000-000000000001'::uuid, '$CompanyId'::uuid, '{}'::jsonb);"
    return ($r -match 'SUITE|@|\.') -and ($r -notmatch 'does not exist|ERROR')
}

function Test-OutboundRpc {
    $js = @"
require('dotenv').config();
const {createClient}=require('@supabase/supabase-js');
const cid='$CompanyId';
const id=$TestIdPlan;
const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const marker='AUTOFIX_'+Date.now();
  const {error:e1}=await s.rpc('style_reservas_apply_from_style',{
    p_company_id:cid,p_accion:'UPDATE',p_idplan:id,
    p_codemp:'1',p_codcli:'0',p_fecha:'2026-12-15',p_horini:'10:00',p_horfin:'10:45',
    p_texto:marker,p_codrec:'',p_nomcli:'Sync Test',p_tel1cli:'',p_facturado:false,
    p_servicios:'',p_colfon:0,p_collet:0
  });
  if(e1){console.log('RPC_FAIL',e1.message);process.exit(1);}
  const {data}=await s.schema('dunasoft').from('plan2009').select('texto').eq('idplan',id).maybeSingle();
  const ok=data&&String(data.texto).includes('AUTOFIX');
  console.log(ok?'OUTBOUND_OK':'OUTBOUND_MISMATCH', data?.texto||'');
  process.exit(ok?0:1);
})();
"@
    $out = Invoke-AgentNode $js
    return $out -match 'OUTBOUND_OK'
}

function Test-InboundPending {
    $r = Test-Sql "SELECT count(*) FROM dunasoft.style_reservas_queue WHERE company_id='$CompanyId' AND delivered_at IS NULL;"
    if ($r -is [System.Management.Automation.ErrorRecord] -or $null -eq $r) { return -1 }
    return [int]($r.ToString().Trim())
}

function Repair-InboundWorker {
    $jsonCount = @(Get-ChildItem "$StyleRoot\sync\inbound\*.json" -EA SilentlyContinue).Count
    if ($jsonCount -le 0) { return }
    $vbs = Join-Path $StyleRoot "run_inbound_worker_hidden.vbs"
    if (Test-Path $vbs) {
        Log "Lanzando worker inbound ($jsonCount JSON pendientes)..."
        Start-Process wscript.exe -ArgumentList "`"$vbs`"" -WindowStyle Hidden -Wait
    }
}

Log "=== style-sync-autofix-loop (max $MaxRounds rondas) ==="
Repair-Codusu | Out-Null
Ensure-AgentRunning | Out-Null

$round = 0
$allOk = $false
while ($round -lt $MaxRounds -and -not $allOk) {
    $round++
    Log "--- Ronda $round ---"
    $checks = @{
        codusu = Test-Codusu
        agent = $true
        outbound = Test-OutboundRpc
        inboundPending = (Test-InboundPending)
    }
    Log ("codusu={0} outbound={1} inbound_pending={2}" -f $checks.codusu, $checks.outbound, $checks.inboundPending)
    if ($checks.inboundPending -gt 0) { Repair-InboundWorker }
    if (-not $checks.codusu) { Repair-Codusu | Out-Null }
    Ensure-AgentRunning | Out-Null
    $allOk = $checks.codusu -and $checks.outbound -and ($checks.inboundPending -eq 0)
    if (-not $allOk) { Start-Sleep -Seconds $IntervalSec }
}

if ($allOk) {
    Log "OK Todas las comprobaciones pasaron."
    exit 0
}
Log "AVISO: algunas comprobaciones siguen fallando tras $MaxRounds rondas. Ver $failLog"
exit 1
