# Configura credenciales SPA3102 en el contenedor edge (Supabase 110).
# La contraseña NO se guarda en el repositorio; solo en .env del servidor.
param(
  [string]$BaseUrl = "http://192.168.99.82",
  [string]$Username = "admin",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"
$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }

if (-not $Password) {
  throw "Pasa -Password (contraseña admin del SPA3102)."
}

Write-Host "Actualizando .env y docker-compose en $SshTarget ..." -ForegroundColor Green
ssh $SshTarget @"
set -e
for line in SPA3102_BASE_URL=$BaseUrl SPA3102_USERNAME=$Username SPA3102_PASSWORD=$Password; do
  key=`$(echo "`$line" | cut -d= -f1)
  grep -q "^`${key}=" /root/supabase-project/.env 2>/dev/null && \
    sed -i "s|^`${key}=.*|`$line|" /root/supabase-project/.env || \
    echo "`$line" >> /root/supabase-project/.env
done
for var in SPA3102_BASE_URL SPA3102_USERNAME SPA3102_PASSWORD; do
  grep -q \"^\${var}:\" /root/supabase-project/docker-compose.yml || \
    sed -i \"/SPA3102_USERNAME:/a\\      \${var}: \\\${\${var}}\" /root/supabase-project/docker-compose.yml
done
python3 - <<'PY'
from pathlib import Path
import re
path = Path('/root/supabase-project/docker-compose.yml')
text = path.read_text(encoding='utf-8')
for key in ('SPA3102_BASE_URL', 'SPA3102_USERNAME', 'SPA3102_PASSWORD', 'SERVICE_MONITOR_CRON_SECRET'):
    want = f'      {key}: ${{{key}}}'
    text = re.sub(rf'^(\s+{re.escape(key)}:\s*).*$', want, text, flags=re.M)
path.write_text(text, encoding='utf-8')
PY
cd /root/supabase-project && docker compose up -d --force-recreate functions && docker restart supabase-kong
"@

Write-Host "OK. SPA3102 monitor: $BaseUrl (usuario $Username)" -ForegroundColor Cyan
