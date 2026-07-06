# Aplica todos los parches de OpenWA y reinicia el contenedor.
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$Key = "$env:USERPROFILE\.ssh\suite_deploy"
$HostAlias = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }

Write-Host "==> Subiendo parches al servidor..." -ForegroundColor Cyan
scp -i $Key "$RepoRoot\openwa\patch_send_audio_voice.py" "${HostAlias}:/tmp/patch_send_audio_voice.py"
scp -i $Key "$RepoRoot\openwa\apply-patches-remote.sh" "${HostAlias}:/tmp/apply-patches-remote.sh"

Write-Host "==> Ejecutando parches en servidor..." -ForegroundColor Cyan
ssh -i $Key $HostAlias 'chmod +x /tmp/apply-patches-remote.sh && bash /tmp/apply-patches-remote.sh'

Write-Host "==> Verificando sesión..." -ForegroundColor Cyan
Start-Sleep -Seconds 15
$sessionCheck = ssh -i $Key $HostAlias @'
curl -s "http://127.0.0.1:2785/api/sessions" \
  -H "X-API-Key: owa_k1_c13e59cd1f7eee1068af57ce8a3d2a213fc191fabf972da49152dd6ac33ce9b4" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
for s in d.get('sessions',[]):
    print(f\"  {s['id']}: {s.get('state','unknown')}\")
" 2>/dev/null || echo "(no se pudo consultar sesiones)"
'@
Write-Host $sessionCheck

Write-Host "Hecho." -ForegroundColor Green