# Configura credenciales MySQL SmartPSS en supabase-edge-functions (servidor 110).
# Uso:
#   .\scripts\configure-smartpss-edge.ps1
#   .\scripts\configure-smartpss-edge.ps1 -Password "Lip0cer0" -HostIp "192.168.99.110"

param(
  [string]$HostIp = $(if ($env:SMARTPSS_MYSQL_HOST) { $env:SMARTPSS_MYSQL_HOST } else { "192.168.99.110" }),
  [int]$Port = $(if ($env:SMARTPSS_MYSQL_PORT) { [int]$env:SMARTPSS_MYSQL_PORT } else { 3306 }),
  [string]$User = $(if ($env:SMARTPSS_MYSQL_USER) { $env:SMARTPSS_MYSQL_USER } else { "root" }),
  [string]$Password = $(if ($env:SMARTPSS_MYSQL_PASSWORD) { $env:SMARTPSS_MYSQL_PASSWORD } else { "" }),
  [string]$Database = $(if ($env:SMARTPSS_MYSQL_DATABASE) { $env:SMARTPSS_MYSQL_DATABASE } else { "smartpss_events" }),
  [string]$Table = $(if ($env:SMARTPSS_MYSQL_TABLE) { $env:SMARTPSS_MYSQL_TABLE } else { "AttendanceRecordInfo" }),
  [string]$SshTarget = $(if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }),
  [string]$EnvFile = "/root/supabase-project/.env",
  [string]$Container = $(if ($env:SUITE_EDGE_CONTAINER) { $env:SUITE_EDGE_CONTAINER } else { "supabase-edge-functions" })
)

$ErrorActionPreference = "Stop"
$IdentityFile = Join-Path $env:USERPROFILE ".ssh\suite_deploy"
$SshArgs = @("-o", "BatchMode=yes")
if (Test-Path $IdentityFile) {
  $SshArgs += @("-i", $IdentityFile)
}

function Invoke-SuiteSsh {
  param([Parameter(Mandatory = $true)][string]$RemoteCommand)
  & ssh @SshArgs $SshTarget $RemoteCommand
  if ($LASTEXITCODE -ne 0) { throw "ssh falló (exit=$LASTEXITCODE): $RemoteCommand" }
}

if (-not $Password) {
  Write-Host 'Indica -Password "..." o $env:SMARTPSS_MYSQL_PASSWORD' -ForegroundColor Yellow
  exit 1
}

$pairs = @(
  "SMARTPSS_MYSQL_HOST=$HostIp",
  "SMARTPSS_MYSQL_PORT=$Port",
  "SMARTPSS_MYSQL_USER=$User",
  "SMARTPSS_MYSQL_PASSWORD=$Password",
  "SMARTPSS_MYSQL_DATABASE=$Database",
  "SMARTPSS_MYSQL_TABLE=$Table"
)

Write-Host "Actualizando variables SMARTPSS_* en $SshTarget ..." -ForegroundColor Green
$tmpEnv = "/tmp/suite.smartpss.env"
$filter = "grep -v '^SMARTPSS_MYSQL_' $EnvFile > $tmpEnv 2>/dev/null || true"
Invoke-SuiteSsh $filter
foreach ($line in $pairs) {
  $escaped = $line.Replace("'", "'\''")
  Invoke-SuiteSsh "printf '%s\n' '$escaped' >> $tmpEnv"
}
Invoke-SuiteSsh "mv $tmpEnv $EnvFile"

$py = @'
from pathlib import Path
import re

path = Path("/root/supabase-project/docker-compose.yml")
text = path.read_text(encoding="utf-8")
keys = [
    "SMARTPSS_MYSQL_HOST",
    "SMARTPSS_MYSQL_PORT",
    "SMARTPSS_MYSQL_USER",
    "SMARTPSS_MYSQL_PASSWORD",
    "SMARTPSS_MYSQL_DATABASE",
    "SMARTPSS_MYSQL_TABLE",
]
for key in keys:
    want = "      " + key + ": ${" + key + "}"
    pattern = re.compile(r"^(\s+" + re.escape(key) + r":\s*).*$", re.M)
    if pattern.search(text):
        text = pattern.sub(want, text, count=1)
        continue
    inserted = False
    for needle in (
        "VERIFY_JWT:",
        "FUNCTIONS_VERIFY_JWT",
        "SUPABASE_SERVICE_ROLE_KEY:",
        "SCALE_INGEST_SECRET:",
        "IMMICH_API_KEY:",
    ):
        lines = text.splitlines()
        out = []
        for line in lines:
            out.append(line)
            if (not inserted) and needle in line:
                out.append(want)
                inserted = True
        if inserted:
            text = "\n".join(out) + "\n"
            break
    if not inserted:
        raise SystemExit(f"No se encontro ancla para insertar {key}")
path.write_text(text, encoding="utf-8")
print("compose ok: SMARTPSS_MYSQL_*")
'@

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($py))
Invoke-SuiteSsh "echo $b64 | base64 -d | python3"

Write-Host "Recreando supabase-edge-functions ..." -ForegroundColor Green
Invoke-SuiteSsh "cd /root/supabase-project && docker compose up -d --no-deps --force-recreate functions"
Start-Sleep -Seconds 4
& ssh @SshArgs $SshTarget "docker restart supabase-kong" | Out-Null
Start-Sleep -Seconds 2

$check = & ssh @SshArgs $SshTarget "docker exec $Container printenv SMARTPSS_MYSQL_HOST 2>/dev/null"
if ($check) {
  Write-Host "OK: SMARTPSS_MYSQL_HOST=$check" -ForegroundColor Green
} else {
  Write-Host "Revisa docker-compose y $EnvFile" -ForegroundColor Yellow
}

Write-Host "Prueba: curl -s -X POST https://supabase.lipoout.com/functions/v1/smartpss-events -H 'Content-Type: application/json' -d '{""action"":""ping""}'" -ForegroundColor DarkGray
