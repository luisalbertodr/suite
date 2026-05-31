# Aplica una migración SQL al Postgres self-hosted (supabase-db).
#
# Uso:
#   .\scripts\deploy-migration.ps1 20260530160000_whatsapp_auto_link_lid_fix.sql
#   .\scripts\deploy-migration.ps1 -LatestWhatsappAutoLink
#
# Variables opcionales:
#   $env:SUITE_SSH_HOST = "suite-supabase"
#   $env:SUITE_DB_CONTAINER = "supabase-db"

param(
  [Parameter(Position = 0)]
  [string]$MigrationFile,

  [switch]$LatestWhatsappAutoLink
)

$ErrorActionPreference = "Stop"

$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }
$DbContainer = if ($env:SUITE_DB_CONTAINER) { $env:SUITE_DB_CONTAINER } else { "supabase-db" }

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($LatestWhatsappAutoLink) {
  $MigrationFile = "20260530160000_whatsapp_auto_link_lid_fix.sql"
}

if (-not $MigrationFile) {
  Write-Host "Indica el archivo: .\scripts\deploy-migration.ps1 20260530160000_whatsapp_auto_link_lid_fix.sql" -ForegroundColor Red
  exit 1
}

$localPath = Join-Path $RepoRoot "supabase\migrations\$MigrationFile"
if (-not (Test-Path $localPath)) {
  throw "No existe: $localPath"
}

$version = ($MigrationFile -replace '\.sql$','')
$remoteTmp = "/tmp/$MigrationFile"
$remoteMark = "/tmp/mark_migration_$version.sql"
$remoteRunner = "/tmp/run_migration_$version.sh"

$markSql = @"
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('$version')
ON CONFLICT DO NOTHING;
"@

$runnerSh = @"
#!/bin/bash
set -euo pipefail
docker cp '$remoteTmp' ${DbContainer}:/tmp/migration.sql
docker cp '$remoteMark' ${DbContainer}:/tmp/mark_migration.sql
docker exec $DbContainer psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /tmp/migration.sql
docker exec $DbContainer psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /tmp/mark_migration.sql
echo OK
"@

$localMark = Join-Path $env:TEMP "mark_migration_$version.sql"
$localRunner = Join-Path $env:TEMP "run_migration_$version.sh"
[System.IO.File]::WriteAllText($localMark, ($markSql -replace "`r`n", "`n"))
[System.IO.File]::WriteAllText($localRunner, ($runnerSh -replace "`r`n", "`n"))

Write-Host "Subiendo $MigrationFile ..." -ForegroundColor Green
& scp $localPath "${SshTarget}:${remoteTmp}"
if ($LASTEXITCODE -ne 0) { throw "scp falló (migración)" }

& scp $localMark "${SshTarget}:${remoteMark}"
if ($LASTEXITCODE -ne 0) { throw "scp falló (mark)" }

& scp $localRunner "${SshTarget}:${remoteRunner}"
if ($LASTEXITCODE -ne 0) { throw "scp falló (runner)" }

Write-Host "Aplicando en $DbContainer ..." -ForegroundColor Green
ssh $SshTarget "chmod +x $remoteRunner && bash $remoteRunner"
if ($LASTEXITCODE -ne 0) { throw "Migración falló" }

Write-Host "Migración $version aplicada." -ForegroundColor Green
