# Sincroniza whatsapp_config.api_key con WAHA_API_KEY del contenedor waha-worker-1 (110).
$ErrorActionPreference = "Stop"
$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }

Write-Host "Leyendo WAHA_API_KEY del contenedor WAHA ..." -ForegroundColor Green
ssh $SshTarget @'
set -euo pipefail
KEY=$(docker inspect waha-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^WAHA_API_KEY=' | cut -d= -f2-)
if [ -z "$KEY" ]; then echo "WAHA_API_KEY no encontrada" >&2; exit 1; fi
docker exec supabase-db psql -U postgres -d postgres -c \
  "UPDATE whatsapp_config SET api_key = '$KEY', last_status = 'WORKING', updated_at = now() WHERE enabled = true RETURNING company_id, session_name, length(api_key) AS key_len, last_status;"
'@

Write-Host "Listo. Recarga WhatsApp en Suite si seguía abierto." -ForegroundColor Green
