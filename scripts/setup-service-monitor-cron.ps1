# Instala cron + script remoto para service-health-monitor.
param(
  [string]$Secret = "",
  [string]$SupabaseUrl = "https://supabase.lipoout.com"
)

$ErrorActionPreference = "Stop"
$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $Secret) {
  $Secret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
}

Write-Host "Subiendo script cron..." -ForegroundColor Green
scp (Join-Path $RepoRoot "scripts\service-health-monitor-cron.sh") "${SshTarget}:/usr/local/bin/suite-service-health-monitor.sh"
ssh $SshTarget "chmod +x /usr/local/bin/suite-service-health-monitor.sh"

ssh $SshTarget @"
grep -q '^SERVICE_MONITOR_CRON_SECRET=' /root/supabase-project/.env 2>/dev/null && \
  sed -i 's/^SERVICE_MONITOR_CRON_SECRET=.*/SERVICE_MONITOR_CRON_SECRET=$Secret/' /root/supabase-project/.env || \
  echo 'SERVICE_MONITOR_CRON_SECRET=$Secret' >> /root/supabase-project/.env
grep -q '^SUPABASE_URL=' /root/supabase-project/.env 2>/dev/null || echo 'SUPABASE_URL=$SupabaseUrl' >> /root/supabase-project/.env
TMP=/tmp/suite-cron
crontab -l 2>/dev/null | grep -v suite-service-health-monitor > `$TMP || true
echo '* * * * * /usr/local/bin/suite-service-health-monitor.sh' >> `$TMP
crontab `$TMP
rm -f `$TMP
crontab -l | grep suite-service-health
"@

ssh $SshTarget "grep -q 'SERVICE_MONITOR_CRON_SECRET:' /root/supabase-project/docker-compose.yml || sed -i '/ISSABEL_INTERNAL_EXTENSIONS_REGEX:/a\      SERVICE_MONITOR_CRON_SECRET: \${SERVICE_MONITOR_CRON_SECRET}' /root/supabase-project/docker-compose.yml; python3 - <<'PY'
from pathlib import Path
import re
path = Path('/root/supabase-project/docker-compose.yml')
text = path.read_text(encoding='utf-8')
for key in ('SERVICE_MONITOR_CRON_SECRET',):
    want = f'      {key}: ${{{key}}}'
    text = re.sub(rf'^(\s+{re.escape(key)}:\s*).*$', want, text, flags=re.M)
path.write_text(text, encoding='utf-8')
PY"

Write-Host "Recreando contenedor edge..." -ForegroundColor Green
ssh $SshTarget "cd /root/supabase-project && docker compose up -d --force-recreate functions && docker restart supabase-kong"

Write-Host "OK. Secreto: SERVICE_MONITOR_CRON_SECRET=$Secret" -ForegroundColor Cyan
