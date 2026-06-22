# Fase 1 automatizable del despliegue Style Sync v2 (desde PC dev con SSH/SMB).
#
# Uso:
#   .\scripts\deploy-style-sync-phase1.ps1
#   .\scripts\deploy-style-sync-phase1.ps1 -SkipMigrations -SkipPrgCopy
#
param(
    [string]$VmHost = "192.168.99.16",
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [string]$CompanyId = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4",
    [switch]$SkipMigrations,
    [switch]$SkipPrgCopy,
    [switch]$SkipAgentEnv
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$prgs = @(
    "suite_cola_sync.prg",
    "suite_control_sync.prg",
    "suite_migrar_cola_sincro.prg",
    "suite_inbound_worker.prg"
)
$syncDirs = @("sync\inbound", "sync\inbound_ack", "sync\archive", "sync\deadletter", "sync\archive\failed")

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "=== $Msg ===" -ForegroundColor Cyan
}

if (-not $SkipMigrations) {
    Write-Step "Migraciones Postgres (110)"
    $migs = @(
        "20260617190000_style_sync_agent_state.sql",
        "20260617193000_style_sync_agent_health.sql",
        "20260617200000_style_sync_agent_metrics.sql",
        "20260617210000_style_sync_agent_lag.sql"
    )
    foreach ($m in $migs) {
        & "$RepoRoot\scripts\deploy-migration.ps1" $m
    }
    ssh suite-supabase "docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c `"INSERT INTO dunasoft.style_sync_agent_state (company_id) VALUES ('$CompanyId') ON CONFLICT (company_id) DO NOTHING;`""
}

if (-not $SkipPrgCopy) {
    Write-Step "PRGs + carpetas sync"
    $targets = @(
        (Join-Path $TestRoot "PROGS"),
        "\\$VmHost\c$\Style-Dunasoft\PROGS"
    )
    foreach ($t in $targets) {
        if (-not (Test-Path $t)) { New-Item -ItemType Directory -Path $t -Force | Out-Null }
        foreach ($p in $prgs) {
            Copy-Item (Join-Path $RepoRoot "vfp\$p") (Join-Path $t $p) -Force
        }
        Write-Host "  OK $t" -ForegroundColor Green
    }
    foreach ($root in @($TestRoot, "\\$VmHost\c$\Style-Dunasoft")) {
        if (-not (Test-Path $root)) { continue }
        foreach ($d in $syncDirs) {
            $path = Join-Path $root $d
            if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
        }
        Write-Host "  sync dirs: $root" -ForegroundColor Green
    }
}

Write-Step "ExportZ PRGs (sin compilar exe)"
& "$RepoRoot\scripts\build-style-exportz.ps1" -SkipRepair -SkipCompile -SkipBuildExe 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  AVISO: build-style-exportz terminó con avisos (FXP bloqueado si VFP abierto). PRGs ya copiados." -ForegroundColor Yellow
}

if (-not $SkipAgentEnv) {
    Write-Step "style-sync-agent/.env"
    $sr = ssh suite-supabase "docker exec supabase-edge-functions printenv SUPABASE_SERVICE_ROLE_KEY"
    if (-not $sr) { throw "No se pudo leer SUPABASE_SERVICE_ROLE_KEY del servidor" }
    $envPath = Join-Path $RepoRoot "style-sync-agent\.env"
    @"
STYLE_ROOT=$TestRoot
SUPABASE_URL=https://supabase.lipoout.com
SUPABASE_SERVICE_ROLE_KEY=$sr
COMPANY_ID=$CompanyId
POLL_MS=1500
INBOUND_POLL_MS=3000
"@ | Set-Content -Path $envPath -Encoding UTF8
    Write-Host "  OK $envPath" -ForegroundColor Green
}

Write-Step "Build TypeScript agente"
Push-Location (Join-Path $RepoRoot "style-sync-agent")
npm run build
Pop-Location

Write-Host ""
Write-Host "Fase 1 completada. Pendiente manual:" -ForegroundColor Yellow
Write-Host "  1) VFP IDE: compilar ExportZ y -AfterBuild -DeployTest"
Write-Host "  2) VM $VmHost : Task Scheduler suite_inbound_worker.prg (30-60s)"
Write-Host "  3) Proxmox: CIFS + stack Portainer (ver style-sync-agent/PROXMOX-LXC-CIFS.md)"
Write-Host "  4) FoxPro en VM: DO PROGS\suite_control_sync.prg / suite_migrar_cola_sincro.prg"
