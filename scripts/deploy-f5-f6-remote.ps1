# Despliega stacks F5 (Inngest) + F6 (Electric) + edge proxy en suite-supabase (110).
# Uso (desde raíz del repo, PowerShell):
#   .\scripts\deploy-f5-f6-remote.ps1
#   .\scripts\deploy-f5-f6-remote.ps1 -SkipElectric
#   .\scripts\deploy-f5-f6-remote.ps1 -SkipInngest

param(
  [switch]$SkipInngest,
  [switch]$SkipElectric,
  [switch]$SkipEdge,
  [switch]$SkipMigration
)

$ErrorActionPreference = 'Stop'
$HostAlias = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { 'suite-supabase' }
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RemoteTmp = '/tmp/suite-f5-f6'

Write-Host "SSH host: $HostAlias"
ssh $HostAlias "mkdir -p $RemoteTmp/scripts $RemoteTmp/suite-jobs $RemoteTmp/supabase/functions/electric-shape-proxy $RemoteTmp/supabase/migrations"

if (-not $SkipInngest) {
  scp -r "$RepoRoot\suite-jobs\*" "${HostAlias}:${RemoteTmp}/suite-jobs/"
  scp "$RepoRoot\scripts\setup-inngest-portainer-stack.py" "${HostAlias}:${RemoteTmp}/scripts/"
}

if (-not $SkipElectric) {
  scp "$RepoRoot\scripts\setup-electric-portainer-stack.py" "${HostAlias}:${RemoteTmp}/scripts/"
  scp "$RepoRoot\scripts\create-electric-replication.sql" "${HostAlias}:${RemoteTmp}/scripts/"
}

if (-not $SkipEdge) {
  scp "$RepoRoot\supabase\functions\electric-shape-proxy\index.ts" "${HostAlias}:${RemoteTmp}/supabase/functions/electric-shape-proxy/"
}

if (-not $SkipMigration) {
  scp "$RepoRoot\supabase\migrations\20261013120000_electric_replication_role.sql" "${HostAlias}:${RemoteTmp}/supabase/migrations/"
}

$remote = @'
set -euo pipefail
export SUITE_REPO_ROOT=/tmp/suite-f5-f6
cd /tmp/suite-f5-f6
'@

if (-not $SkipMigration) {
  $remote += @"

echo '=== migration electric role ==='
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/20261013120000_electric_replication_role.sql || true
"@
}

if (-not $SkipInngest) {
  $remote += @"

echo '=== setup Inngest ==='
python3 scripts/setup-inngest-portainer-stack.py
"@
}

if (-not $SkipElectric) {
  $remote += @"

echo '=== setup Electric ==='
python3 scripts/setup-electric-portainer-stack.py || true
"@
}

if (-not $SkipEdge) {
  $FunctionsPath = if ($env:SUITE_FUNCTIONS_PATH) { $env:SUITE_FUNCTIONS_PATH } else { '/root/supabase-project/volumes/functions' }
  $EdgeContainer = if ($env:SUITE_EDGE_CONTAINER) { $env:SUITE_EDGE_CONTAINER } else { 'supabase-edge-functions' }
  $remote += @"

echo '=== edge electric-shape-proxy ==='
mkdir -p $FunctionsPath/electric-shape-proxy
cp -f supabase/functions/electric-shape-proxy/index.ts $FunctionsPath/electric-shape-proxy/index.ts
# ELECTRIC_URL for proxy (host gateway → Electric :3060)
if ! grep -q 'ELECTRIC_URL' /root/supabase-project/docker-compose.yml 2>/dev/null; then
  echo 'TIP: set ELECTRIC_URL=http://172.17.0.1:3060 on edge-functions env'
fi
docker restart $EdgeContainer >/dev/null
sleep 3
docker logs --tail 30 $EdgeContainer || true
"@
}

$remote += "`necho DONE_F5_F6`n"
ssh $HostAlias $remote
Write-Host "Listo. FE: merge main + deploy-frontend.ps1; env VITE_INNGEST_UI_URL / VITE_SUITE_JOBS_HEALTH_URL"
