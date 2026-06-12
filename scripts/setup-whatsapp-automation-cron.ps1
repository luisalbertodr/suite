# Instala cron de recordatorios WhatsApp (cada 5 min) en suite-supabase
param(
  [string]$SshTarget = $(if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { 'suite-supabase' })
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$cronSh = Join-Path $repoRoot 'scripts\whatsapp-automation-cron.sh'

Write-Host "Subiendo whatsapp-automation-cron.sh ..." -ForegroundColor Green
scp $cronSh "${SshTarget}:/usr/local/bin/suite-whatsapp-automation-cron.sh"
ssh $SshTarget "chmod +x /usr/local/bin/suite-whatsapp-automation-cron.sh"

Write-Host "Instalando crontab (*/5) ..." -ForegroundColor Green
ssh $SshTarget "( crontab -l 2>/dev/null | grep -v suite-whatsapp-automation-cron; echo '*/5 * * * * /usr/local/bin/suite-whatsapp-automation-cron.sh' ) | crontab - && crontab -l | grep whatsapp-automation"

Write-Host "OK. Cron WhatsApp automation instalado." -ForegroundColor Cyan
