# Configura Immich en el contenedor supabase-edge-functions (servidor 110).
# Uso: .\scripts\configure-immich-edge.ps1 -ApiKey "tu-clave"
#
param(
  [string]$ApiKey = $env:IMMICH_API_KEY,
  [string]$BaseUrl = "http://192.168.99.110:2283",
  [string]$SshTarget = $(if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }),
  [string]$EnvFile = "/root/supabase-project/.env",
  [string]$Container = $(if ($env:SUITE_EDGE_CONTAINER) { $env:SUITE_EDGE_CONTAINER } else { "supabase-edge-functions" })
)

$ErrorActionPreference = "Stop"
if (-not $ApiKey) {
  Write-Host 'Indica -ApiKey "..." o $env:IMMICH_API_KEY' -ForegroundColor Yellow
  exit 1
}

$base = $BaseUrl.TrimEnd('/')
ssh $SshTarget "grep -v '^IMMICH_' $EnvFile > /tmp/suite.env 2>/dev/null || true; printf '%s\n' 'IMMICH_BASE_URL=$base' 'IMMICH_API_KEY=$ApiKey' >> /tmp/suite.env; mv /tmp/suite.env $EnvFile"

$py = @'
from pathlib import Path
p = Path("/root/supabase-project/docker-compose.yml")
lines = p.read_text().splitlines()
out = []
for line in lines:
    if line.strip().startswith("IMMICH_"):
        continue
    out.append(line)
    if "VERIFY_JWT:" in line and "FUNCTIONS_VERIFY_JWT" in line:
        out.append("      IMMICH_BASE_URL: ${IMMICH_BASE_URL}")
        out.append("      IMMICH_API_KEY: ${IMMICH_API_KEY}")
p.write_text("\n".join(out) + "\n")
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($py))
ssh $SshTarget "echo $b64 | base64 -d | python3"
ssh $SshTarget "cd /root/supabase-project && docker compose up -d --no-deps functions"
Start-Sleep -Seconds 4
# Tras recrear functions, asegurar que .env sigue alineado con Kong/Auth (evita 500 en main).
$fixScript = Join-Path $PSScriptRoot "fix-supabase-env-keys.py"
if (Test-Path $fixScript) {
  scp $fixScript "${SshTarget}:/tmp/fix-supabase-env-keys.py" | Out-Null
  ssh $SshTarget "python3 /tmp/fix-supabase-env-keys.py && cd /root/supabase-project && docker compose up -d --no-deps --force-recreate functions"
  Start-Sleep -Seconds 4
}
ssh $SshTarget "docker restart supabase-kong" | Out-Null
Start-Sleep -Seconds 3
$check = ssh $SshTarget "docker exec $Container printenv IMMICH_BASE_URL 2>/dev/null"
if ($check) { Write-Host "OK: IMMICH_BASE_URL=$check" -ForegroundColor Green }
else { Write-Host "Revisa docker compose y $EnvFile" -ForegroundColor Yellow }
