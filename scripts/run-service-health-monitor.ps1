# Dispara manualmente el monitor de servicios (desde desarrollo).
param(
  [string]$SupabaseUrl = $env:VITE_SUPABASE_URL,
  [string]$Secret = $env:SERVICE_MONITOR_CRON_SECRET,
  [switch]$UseServiceRole
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not $SupabaseUrl) {
  $envFile = Join-Path $RepoRoot ".env"
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*VITE_SUPABASE_URL\s*=\s*"?([^"#]+)"?\s*$') {
        $SupabaseUrl = $Matches[1].Trim()
      }
    }
  }
}
if (-not $SupabaseUrl) { throw "Define VITE_SUPABASE_URL o pasa -SupabaseUrl" }

$headers = @{ "Content-Type" = "application/json" }
if ($UseServiceRole) {
  $key = $env:SUPABASE_SERVICE_ROLE_KEY
  if (-not $key) { throw "Define SUPABASE_SERVICE_ROLE_KEY" }
  $headers["Authorization"] = "Bearer $key"
} elseif ($Secret) {
  $headers["x-monitor-secret"] = $Secret
} else {
  throw "Pasa -Secret o -UseServiceRole"
}

$uri = "$SupabaseUrl/functions/v1/service-health-monitor"
$body = '{"source":"manual","run_recovery":true}'
Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body | ConvertTo-Json -Depth 6
