# Build y despliegue del contenedor style-sync-agent en suite-supabase (110).
#
# Uso:
#   .\scripts\deploy-style-sync-agent.ps1
#   .\scripts\deploy-style-sync-agent.ps1 -RemoteOnly

param(
    [string]$SshHost = "suite-supabase",
    [string]$CompanyId = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4",
    [string]$StyleRoot = "/mnt/style",
    [switch]$RemoteOnly,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AgentDir = Join-Path $RepoRoot "style-sync-agent"
$Key = Join-Path $env:USERPROFILE ".ssh\suite_deploy"
$ssh = @("-i", $Key, $SshHost)

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "=== $Msg ===" -ForegroundColor Cyan
}

if (-not $SkipBuild -and -not $RemoteOnly) {
    Write-Step "npm run build"
    Push-Location $AgentDir
    npm run build
    Pop-Location
}

Write-Step "Subir style-sync-agent a $SshHost"
$remoteBase = "/root/style-sync-agent"
ssh @ssh "mkdir -p $remoteBase"
scp -i $Key -r "$AgentDir\dist" "$AgentDir\src" "$AgentDir\package.json" "$AgentDir\package-lock.json" "$AgentDir\tsconfig.json" "$AgentDir\Dockerfile" `
    "${SshHost}:${remoteBase}/"

$sr = ssh @ssh "docker exec supabase-edge-functions printenv SUPABASE_SERVICE_ROLE_KEY"
if (-not $sr) { throw "No se pudo leer SUPABASE_SERVICE_ROLE_KEY" }

Write-Step "Docker build + run"
$runCmd = "docker run -d --name style-sync-agent --restart unless-stopped -e STYLE_ROOT=$StyleRoot -e SUPABASE_URL=https://supabase.lipoout.com -e SUPABASE_SERVICE_ROLE_KEY=$sr -e COMPANY_ID=$CompanyId -e POLL_MS=1500 -e INBOUND_POLL_MS=3000 -e PLAN2009_POLL_ENABLED=1 -e SYNC_EVENT_DRIVEN=1 -e ENTITY_POLL_MS=120000 -v ${StyleRoot}:${StyleRoot}:rw style-sync-agent:0.2.1"
$dockerLines = @(
    "set -e",
    "cd $remoteBase",
    "docker build -t style-sync-agent:0.2.1 .",
    "docker rm -f style-sync-agent 2>/dev/null || true",
    $runCmd,
    "docker logs --tail 20 style-sync-agent"
)
($dockerLines -join "`n") | ssh @ssh "bash -s"

Write-Host ""
Write-Host "Agente desplegado. Verifica: docker logs -f style-sync-agent" -ForegroundColor Green
