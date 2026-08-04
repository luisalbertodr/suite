# Instala recuperación automática de WAHA (pull+recreate) + agente HTTP.
param(
  [string]$RecoverSecret = "",
  [int]$Port = 3399,
  [string]$PublicUrl = "http://192.168.99.110:3399/recover"
)

$ErrorActionPreference = "Stop"
$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $RecoverSecret) {
  $RecoverSecret = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
}

Write-Host "Subiendo scripts..." -ForegroundColor Green
scp (Join-Path $RepoRoot "scripts\suite-waha-recover.sh") "${SshTarget}:/usr/local/bin/suite-waha-recover.sh"
scp (Join-Path $RepoRoot "scripts\suite-waha-recover-agent.py") "${SshTarget}:/usr/local/bin/suite-waha-recover-agent.py"
scp (Join-Path $RepoRoot "scripts\service-health-monitor-cron.sh") "${SshTarget}:/usr/local/bin/suite-service-health-monitor.sh"

$installSh = @"
#!/bin/bash
set -euo pipefail
PORT='$Port'
SECRET='$RecoverSecret'
PUBLIC_URL='$PublicUrl'

chmod +x /usr/local/bin/suite-waha-recover.sh /usr/local/bin/suite-service-health-monitor.sh
chmod +x /usr/local/bin/suite-waha-recover-agent.py
mkdir -p /var/lib/suite /var/log

if docker inspect waha-worker-1 >/dev/null 2>&1; then
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' waha-worker-1 > /var/lib/suite/waha-worker.env
fi

ENVF=/root/supabase-project/.env
touch "`$ENVF"
upsert_env() {
  local key="`$1" val="`$2"
  if grep -q "^`${key}=" "`$ENVF"; then
    sed -i "s|^`${key}=.*|`${key}=`${val}|" "`$ENVF"
  else
    echo "`${key}=`${val}" >> "`$ENVF"
  fi
}
upsert_env WAHA_HOST_RECOVERY_SECRET "`$SECRET"
upsert_env WAHA_HOST_RECOVERY_URL "`$PUBLIC_URL"

python3 - <<'PY'
from pathlib import Path
import re
path = Path('/root/supabase-project/docker-compose.yml')
text = path.read_text(encoding='utf-8')
keys = {
    'WAHA_HOST_RECOVERY_URL': '      WAHA_HOST_RECOVERY_URL: `${WAHA_HOST_RECOVERY_URL}',
    'WAHA_HOST_RECOVERY_SECRET': '      WAHA_HOST_RECOVERY_SECRET: `${WAHA_HOST_RECOVERY_SECRET}',
}
for key, want in keys.items():
    if re.search(rf'^\s+{re.escape(key)}:', text, flags=re.M):
        text = re.sub(rf'^(\s+{re.escape(key)}:\s*).*$', want, text, flags=re.M)
    elif re.search(r'^\s+SERVICE_MONITOR_CRON_SECRET:', text, flags=re.M):
        text = re.sub(
            r'(^\s+SERVICE_MONITOR_CRON_SECRET:.*$)',
            rf'\1\n{want}',
            text,
            count=1,
            flags=re.M,
        )
    else:
        text = text.replace('    environment:', f'    environment:\n{want}', 1)
path.write_text(text, encoding='utf-8')
print('compose ok')
PY

cat > /etc/systemd/system/suite-waha-recover-agent.service <<EOF
[Unit]
Description=Suite WAHA host recovery agent
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=WAHA_RECOVER_BIND=0.0.0.0
Environment=WAHA_RECOVER_PORT=`$PORT
EnvironmentFile=-/root/supabase-project/.env
Environment=WAHA_RECOVER_SCRIPT=/usr/local/bin/suite-waha-recover.sh
ExecStart=/usr/bin/python3 /usr/local/bin/suite-waha-recover-agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now suite-waha-recover-agent.service
sleep 1
systemctl --no-pager --full status suite-waha-recover-agent.service | head -15
curl -sS -m 3 "http://127.0.0.1:`$PORT/health"
echo
"@

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($installSh))
ssh $SshTarget "echo $b64 | base64 -d | bash"

Write-Host "Recreando edge functions..." -ForegroundColor Green
ssh $SshTarget "cd /root/supabase-project && docker compose up -d --force-recreate functions && docker restart supabase-kong"

Write-Host "OK" -ForegroundColor Cyan
Write-Host "WAHA_HOST_RECOVERY_URL=$PublicUrl"
Write-Host "WAHA_HOST_RECOVERY_SECRET=$RecoverSecret"
