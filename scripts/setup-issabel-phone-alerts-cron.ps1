# Instala cron de alertas WhatsApp por llamadas perdidas / buzón Issabel en servidor 110.
$ErrorActionPreference = "Stop"
$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }
$repoRoot = Split-Path -Parent $PSScriptRoot
$cronSh = Join-Path $repoRoot 'scripts\issabel-phone-alerts-cron.sh'

Write-Host "Subiendo issabel-phone-alerts-cron.sh ..." -ForegroundColor Green
scp $cronSh "${SshTarget}:/usr/local/bin/suite-issabel-phone-alerts-cron.sh"
ssh $SshTarget "chmod +x /usr/local/bin/suite-issabel-phone-alerts-cron.sh && sed -i 's/\r$//' /usr/local/bin/suite-issabel-phone-alerts-cron.sh"

Write-Host "Instalando crontab (cada 2 min) ..." -ForegroundColor Green
ssh $SshTarget "( crontab -l 2>/dev/null | grep -v suite-issabel-phone-alerts-cron; echo '*/2 * * * * /usr/local/bin/suite-issabel-phone-alerts-cron.sh' ) | crontab - && crontab -l | grep issabel-phone-alerts"

Write-Host "Listo. Log: /var/log/suite-issabel-phone-alerts.log" -ForegroundColor Green
