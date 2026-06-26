# Repara OpenWA en producción (media 500 por whatsapp-web.js 1.34.7).
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$Key = "$env:USERPROFILE\.ssh\suite_deploy"
$HostAlias = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }

Write-Host "Subiendo fix-openwa-media.sh y parche..." -ForegroundColor Cyan
scp -i $Key "$RepoRoot\scripts\fix-openwa-media.sh" "${HostAlias}:/tmp/fix-openwa-media.sh"
scp -i $Key "$RepoRoot\openwa\patch_send_audio_voice.py" "${HostAlias}:/tmp/patch_send_audio_voice.py"

Write-Host "Ejecutando en servidor (puede tardar ~90s)..." -ForegroundColor Cyan
ssh -i $Key $HostAlias "chmod +x /tmp/fix-openwa-media.sh && OPENWA_API_KEY=owa_k1_c13e59cd1f7eee1068af57ce8a3d2a213fc191fabf972da49152dd6ac33ce9b4 OPENWA_SESSION_ID=80ad9168-a82d-41d0-a75e-9806e850b4fe PATCH_PY=/tmp/patch_send_audio_voice.py bash /tmp/fix-openwa-media.sh"

Write-Host "Comprobando send-audio..." -ForegroundColor Cyan
ssh -i $Key $HostAlias 'python3 << "PYEOF"
import json, base64, urllib.request, urllib.error
try:
    b=open("/tmp/test.ogg","rb").read()
except FileNotFoundError:
    print("skip smoke test (no /tmp/test.ogg)")
    raise SystemExit(0)
raw=base64.b64encode(b).decode()
p={"chatId":"34667435503@c.us","base64":raw,"mimetype":"application/ogg"}
req=urllib.request.Request(
    "http://127.0.0.1:2785/api/sessions/80ad9168-a82d-41d0-a75e-9806e850b4fe/messages/send-audio",
    data=json.dumps(p).encode(),
    headers={"Content-Type":"application/json","X-API-Key":"owa_k1_c13e59cd1f7eee1068af57ce8a3d2a213fc191fabf972da49152dd6ac33ce9b4"},
    method="POST",
)
try:
    r=urllib.request.urlopen(req,timeout=60)
    print("OK send-audio", r.status)
except urllib.error.HTTPError as e:
    print("FAIL send-audio", e.code, e.read()[:120])
PYEOF'

Write-Host "Hecho." -ForegroundColor Green
