# Despliega stacks F5 (Inngest) + F6 (Electric) + edge proxy en suite-supabase (110).
# Uso (desde raíz del repo, PowerShell):
#   .\scripts\deploy-f5-f6-remote.ps1

$ErrorActionPreference = 'Stop'
$HostAlias = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { 'suite-supabase' }
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RemoteTmp = '/tmp/suite-f5-f6'

Write-Host "SSH host: $HostAlias"
ssh $HostAlias "mkdir -p $RemoteTmp/scripts $RemoteTmp/suite-jobs $RemoteTmp/supabase/functions/electric-shape-proxy $RemoteTmp/supabase/migrations"

scp -r "$RepoRoot\suite-jobs\package.json" "$RepoRoot\suite-jobs\package-lock.json" "$RepoRoot\suite-jobs\tsconfig.json" "$RepoRoot\suite-jobs\Dockerfile" "$RepoRoot\suite-jobs\.dockerignore" "${HostAlias}:${RemoteTmp}/suite-jobs/"
ssh $HostAlias "mkdir -p $RemoteTmp/suite-jobs/src/inngest"
scp "$RepoRoot\suite-jobs\src\index.ts" "${HostAlias}:${RemoteTmp}/suite-jobs/src/"
scp "$RepoRoot\suite-jobs\src\inngest\client.ts" "$RepoRoot\suite-jobs\src\inngest\functions.ts" "${HostAlias}:${RemoteTmp}/suite-jobs/src/inngest/"

scp "$RepoRoot\scripts\setup-inngest-portainer-stack.py" "$RepoRoot\scripts\setup-electric-portainer-stack.py" "$RepoRoot\scripts\create-electric-replication.sql" "$RepoRoot\scripts\deploy-f5-f6-remote.sh" "${HostAlias}:${RemoteTmp}/scripts/"
scp "$RepoRoot\supabase\functions\electric-shape-proxy\index.ts" "${HostAlias}:${RemoteTmp}/supabase/functions/electric-shape-proxy/"
scp "$RepoRoot\supabase\migrations\20261013120000_electric_replication_role.sql" "${HostAlias}:${RemoteTmp}/supabase/migrations/"

# Subir script con LF y ejecutarlo
ssh $HostAlias "sed -i 's/\r$//' $RemoteTmp/scripts/deploy-f5-f6-remote.sh && chmod +x $RemoteTmp/scripts/deploy-f5-f6-remote.sh && bash $RemoteTmp/scripts/deploy-f5-f6-remote.sh"

Write-Host "Listo. FE: deploy-frontend.ps1 con VITE_INNGEST_UI_URL / VITE_SUITE_JOBS_HEALTH_URL"
