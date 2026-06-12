# Configura Gmail SMTP en el servidor Supabase (110) para envío desde info@lipoout.com.
# La contraseña NO se guarda en el repositorio; solo en .env del servidor.
param(
  [string]$SmtpUser = "lipoutcoruna@gmail.com",
  [string]$SmtpPassword = "",
  [string]$EmailFrom = "info@lipoout.com",
  [string]$EmailFromName = "Lipoout"
)

$ErrorActionPreference = "Stop"
$SshTarget = if ($env:SUITE_SSH_HOST) { $env:SUITE_SSH_HOST } else { "suite-supabase" }

if (-not $SmtpPassword) {
  throw "Pasa -SmtpPassword (contraseña de aplicación Gmail, sin espacios)."
}

$pass = ($SmtpPassword -replace '\s', '')

$envLines = @(
  "SMTP_HOST=smtp.gmail.com",
  "SMTP_PORT=587",
  "SMTP_USER=$SmtpUser",
  "SMTP_PASSWORD=$pass",
  "EMAIL_FROM=$EmailFrom",
  "EMAIL_FROM_NAME=$EmailFromName"
)

Write-Host "Actualizando .env en $SshTarget ..." -ForegroundColor Green
foreach ($line in $envLines) {
  $key = ($line -split '=', 2)[0]
  ssh $SshTarget "grep -q '^${key}=' /root/supabase-project/.env 2>/dev/null && sed -i 's|^${key}=.*|${line}|' /root/supabase-project/.env || echo '${line}' >> /root/supabase-project/.env"
}

Write-Host "Añadiendo variables al docker-compose (functions) ..." -ForegroundColor Green
$composeVars = @('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM', 'EMAIL_FROM_NAME')
foreach ($var in $composeVars) {
  ssh $SshTarget "grep -q '${var}:' /root/supabase-project/docker-compose.yml || sed -i '/SERVICE_MONITOR_CRON_SECRET:/a\      ${var}: \`${var}\`' /root/supabase-project/docker-compose.yml"
}

Write-Host "Actualizando system_settings (email_from) para todas las empresas ..." -ForegroundColor Green
$sql = @"
INSERT INTO public.system_settings (company_id, setting_key, setting_value, setting_type, description)
SELECT c.id, k.key, k.val, k.typ, k.descr
FROM public.companies c
CROSS JOIN (VALUES
  ('email_from', '$EmailFrom', 'text', 'Remitente SMTP'),
  ('email_from_name', '$EmailFromName', 'text', 'Nombre remitente'),
  ('email_provider', 'smtp', 'text', 'Proveedor email')
) AS k(key, val, typ, descr)
ON CONFLICT (company_id, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();
"@

$sql | ssh $SshTarget "docker exec -i supabase-db psql -U postgres -d postgres"

Write-Host "Recreando contenedor edge ..." -ForegroundColor Green
ssh $SshTarget "cd /root/supabase-project && docker compose up -d --force-recreate functions && docker restart supabase-kong"

Write-Host "OK. Email configurado: $EmailFrom via $SmtpUser" -ForegroundColor Cyan
