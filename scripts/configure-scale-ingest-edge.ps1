# Configura SCALE_INGEST_SECRET en supabase-edge-functions (servidor 110).
# Uso:
#   .\scripts\configure-scale-ingest-edge.ps1 -Secret "tu-secreto"
#   .\scripts\configure-scale-ingest-edge.ps1   # genera un secreto aleatorio

param(
  [string]$Secret = "",
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

if (-not $Secret) {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $Secret = ([Convert]::ToBase64String($bytes) -replace '[+/=]', 'x')
  Write-Host "Secreto generado (guardalo): $Secret" -ForegroundColor Cyan
}

Write-Host "Actualizando SCALE_INGEST_SECRET en $SshTarget ..." -ForegroundColor Green
$escapedSecret = $Secret.Replace("'", "'\''")
Invoke-SuiteSsh "grep -q '^SCALE_INGEST_SECRET=' $EnvFile 2>/dev/null && sed -i 's|^SCALE_INGEST_SECRET=.*|SCALE_INGEST_SECRET=$escapedSecret|' $EnvFile || echo 'SCALE_INGEST_SECRET=$escapedSecret' >> $EnvFile"

$py = @'
from pathlib import Path
import re
path = Path("/root/supabase-project/docker-compose.yml")
text = path.read_text(encoding="utf-8")
key = "SCALE_INGEST_SECRET"
want = "      " + key + ": ${" + key + "}"
pattern = re.compile(r"^(\s+" + re.escape(key) + r":\s*).*$", re.M)
if pattern.search(text):
    text = pattern.sub(want, text, count=1)
else:
    inserted = False
    for needle in (
        "VERIFY_JWT:",
        "FUNCTIONS_VERIFY_JWT",
        "SUPABASE_SERVICE_ROLE_KEY:",
        "SERVICE_MONITOR_CRON_SECRET:",
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
        raise SystemExit("No se encontro ancla para insertar SCALE_INGEST_SECRET")
path.write_text(text, encoding="utf-8")
print("compose ok: SCALE_INGEST_SECRET")
'@

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($py))
Invoke-SuiteSsh "echo $b64 | base64 -d | python3"

Write-Host "Recreando supabase-edge-functions ..." -ForegroundColor Green
Invoke-SuiteSsh "cd /root/supabase-project && docker compose up -d --no-deps --force-recreate functions"
Start-Sleep -Seconds 4
& ssh @SshArgs $SshTarget "docker restart supabase-kong" | Out-Null
Start-Sleep -Seconds 2

$check = & ssh @SshArgs $SshTarget "docker exec $Container printenv SCALE_INGEST_SECRET 2>/dev/null"
if ($check) {
  Write-Host "OK: SCALE_INGEST_SECRET configurado ($($check.Length) chars)" -ForegroundColor Green
} else {
  Write-Host "Revisa docker-compose y $EnvFile" -ForegroundColor Yellow
}

Write-Host "Prueba: curl -s https://supabase.lipoout.com/functions/v1/scale-ingest" -ForegroundColor DarkGray
