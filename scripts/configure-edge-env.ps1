# Repara variables del contenedor edge (Issabel, SPA3102, monitor) en Supabase 110.
# Uso:
#   .\scripts\configure-edge-env.ps1
#   .\scripts\configure-edge-env.ps1 -Spa3102Password '...' -IssabelApiToken '...'

param(
  [string]$IssabelCdrUrl = "http://192.168.99.36:8888/api_cdr.php",
  [string]$IssabelApiToken = "",
  [string]$Spa3102BaseUrl = "http://192.168.99.82",
  [string]$Spa3102Username = "admin",
  [string]$Spa3102Password = "",
  [string]$ServiceMonitorSecret = ""
)

$ErrorActionPreference = "Stop"
$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }
$EnvFile = "/root/supabase-project/.env"
$ComposeFile = "/root/supabase-project/docker-compose.yml"

function Set-RemoteEnvLine {
  param([string]$Key, [string]$Value)
  if (-not $Value) { return }
  $escaped = $Value -replace "'", "'\\''"
  ssh $SshTarget "grep -q '^${Key}=' $EnvFile 2>/dev/null && sed -i 's|^${Key}=.*|${Key}=${escaped}|' $EnvFile || echo '${Key}=${escaped}' >> $EnvFile"
}

function Ensure-ComposeRef {
  param([string]$Key)
  ssh $SshTarget @"
python3 - <<'PY'
from pathlib import Path
import re
path = Path('$ComposeFile')
text = path.read_text(encoding='utf-8')
key = '$Key'
want = f'      {key}: \${{{key}}}'
pattern = re.compile(rf'^(\s+{re.escape(key)}:\s*).*$', re.M)
if pattern.search(text):
    text = pattern.sub(want, text, count=1)
else:
    anchor = '      ISSABEL_INTERNAL_EXTENSIONS_REGEX: \${ISSABEL_INTERNAL_EXTENSIONS_REGEX}'
    if anchor not in text:
        raise SystemExit(f'anchor not found for {key}')
    text = text.replace(anchor, anchor + '\n' + want, 1)
path.write_text(text, encoding='utf-8')
print(f'compose ok: {key}')
PY
"@
}

Write-Host "Actualizando $EnvFile en $SshTarget ..." -ForegroundColor Green

if ($IssabelApiToken) {
  Set-RemoteEnvLine "ISSABEL_API_TOKEN" $IssabelApiToken
}
Set-RemoteEnvLine "ISSABEL_CDR_URL" $IssabelCdrUrl
Set-RemoteEnvLine "ISSABEL_INTERNAL_EXTENSIONS_REGEX" '^\d{2,6}$'

if ($Spa3102Password) {
  Set-RemoteEnvLine "SPA3102_BASE_URL" $Spa3102BaseUrl
  Set-RemoteEnvLine "SPA3102_USERNAME" $Spa3102Username
  Set-RemoteEnvLine "SPA3102_PASSWORD" $Spa3102Password
}

if ($ServiceMonitorSecret) {
  Set-RemoteEnvLine "SERVICE_MONITOR_CRON_SECRET" $ServiceMonitorSecret
}

Write-Host "Reparando referencias en docker-compose.yml ..." -ForegroundColor Green
foreach ($key in @(
  'ISSABEL_CDR_URL', 'ISSABEL_API_TOKEN', 'ISSABEL_INTERNAL_EXTENSIONS_REGEX',
  'SERVICE_MONITOR_CRON_SECRET', 'SPA3102_BASE_URL', 'SPA3102_USERNAME', 'SPA3102_PASSWORD'
)) {
  Ensure-ComposeRef $key
}

Write-Host "Recreando supabase-edge-functions ..." -ForegroundColor Green
ssh $SshTarget "cd /root/supabase-project && docker compose up -d --force-recreate functions && docker restart supabase-kong && sleep 2"

Write-Host "Comprobando variables en el contenedor ..." -ForegroundColor Green
ssh $SshTarget @"
docker exec supabase-edge-functions printenv | grep -E '^(ISSABEL_|SPA3102_|SERVICE_MONITOR)' | sed 's/=.*/=***/' | sort
"@

Write-Host "OK. Edge recreado con Issabel/SPA3102." -ForegroundColor Cyan
