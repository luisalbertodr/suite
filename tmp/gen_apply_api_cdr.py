import base64
import pathlib

src = pathlib.Path("scripts/issabel/api_cdr.php").read_text(encoding="utf-8")
lines = src.splitlines(keepends=True)
header = "".join(lines[:16])
body = "".join(lines[21:])
body_b64 = base64.b64encode(body.encode("utf-8")).decode("ascii")

script = f"""#!/bin/bash
set -euo pipefail
FILE=/var/www/html_api/api_cdr.php
DIR=/var/www/html_api
BK="${{FILE}}.bak.$(date +%Y%m%d%H%M)"
TMP="${{FILE}}.new"
HTTPD_SNIPPET=/etc/httpd/conf.d/suite-html_api.conf

issabel_read_ampdbpass() {{
  local f val
  for f in /etc/amportal.conf /etc/issabel.conf; do
    if [[ -f "$f" ]]; then
      val="$(grep -E '^AMPDBPASS=' "$f" | tail -1 | sed -E 's/^AMPDBPASS=//' | tr -d '\\"' | tr -d \"'\")"
      if [[ -n "$val" ]]; then
        echo "$val"
        return 0
      fi
    fi
  done
  return 1
}}

issabel_ensure_httpd_8888() {{
  if ss -tlnp 2>/dev/null | grep -q ':8888 '; then
    echo "Puerto 8888 ya escuchando"
    return 0
  fi
  echo "Configurando Apache en puerto 8888 ..."
  mkdir -p "$DIR"
  cat > "$HTTPD_SNIPPET" << 'APACHE'
Listen 8888
<VirtualHost *:8888>
    ServerName issabel-api.local
    DocumentRoot /var/www/html_api
    <Directory /var/www/html_api>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>
    ErrorLog /var/log/httpd/suite-html_api-error.log
    CustomLog /var/log/httpd/suite-html_api-access.log combined
</VirtualHost>
APACHE
  if command -v httpd >/dev/null 2>&1; then
    httpd -t
    systemctl enable httpd >/dev/null 2>&1 || true
    systemctl restart httpd
  elif command -v apachectl >/dev/null 2>&1; then
    apachectl configtest
    systemctl enable apache2 >/dev/null 2>&1 || systemctl enable httpd >/dev/null 2>&1 || true
    systemctl restart apache2 >/dev/null 2>&1 || systemctl restart httpd
  else
    echo "ERROR: no se encontró httpd/apache para servir :8888" >&2
    return 1
  fi
  sleep 1
  if ! ss -tlnp 2>/dev/null | grep -q ':8888 '; then
    echo "ERROR: Apache no escucha en 8888 tras reinicio" >&2
    return 1
  fi
  echo "Apache escuchando en 8888"
}}

mkdir -p "$DIR"

if [[ -f "$FILE" ]]; then
  cp "$FILE" "$BK"
  echo "Backup: $BK"
else
  echo "Instalación nueva: no existe $FILE"
  BK=""
fi

cat > "$TMP" << 'HEADER'
{header}HEADER

if [[ -n "$BK" ]]; then
  if ! grep -E '^\\$(api_token_valido|db_user|db_pass|db_name)' "$BK" >> "$TMP"; then
    echo "ERROR: backup sin variables de configuración" >&2
    exit 1
  fi
else
  DB_PASS="$(issabel_read_ampdbpass || true)"
  if [[ -z "$DB_PASS" ]]; then
    echo "ERROR: no se pudo leer AMPDBPASS de /etc/amportal.conf" >&2
    exit 1
  fi
  API_TOKEN="${{SUITE_ISSABEL_API_TOKEN:-}}"
  if [[ -z "$API_TOKEN" ]]; then
    if command -v openssl >/dev/null 2>&1; then
      API_TOKEN="$(openssl rand -hex 24)"
    else
      API_TOKEN="$(date +%s)-suite-issabel"
    fi
    echo "AVISO: token generado en Issabel. Debe coincidir con ISSABEL_API_TOKEN en Supabase:"
    echo "  $API_TOKEN"
  fi
  cat >> "$TMP" << CFG
\\$api_token_valido = '$API_TOKEN';
\\$db_user = 'asteriskuser';
\\$db_pass = '$DB_PASS';
\\$db_name = 'asteriskcdrdb';
CFG
fi

echo '// -----------------------------------------------------------------' >> "$TMP"
base64 -d >> "$TMP" << 'END_BODY'
{body_b64}
END_BODY

php -l "$TMP" >/dev/null
mv "$TMP" "$FILE"
chmod 644 "$FILE"
chown apache:apache "$FILE" 2>/dev/null || chown www-data:www-data "$FILE" 2>/dev/null || true
echo "OK api_cdr.php desplegado en $FILE"

issabel_ensure_httpd_8888

TOKEN=$(grep '^\\$api_token_valido' "$FILE" | sed -E "s/^[^']*'([^']*)'.*/\\1/")
CODE=$(curl -s -o /dev/null -w '%{{http_code}}' -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8888/api_cdr.php?from=$(date +%Y-%m-01)&limit=1" || true)
echo "Smoke test listado CDR -> HTTP $CODE"
if [[ "$CODE" != "200" ]]; then
  echo "ERROR: api_cdr.php no responde 200 (revisa httpd, PHP y credenciales MySQL)" >&2
  exit 1
fi
"""

out = pathlib.Path("tmp/apply-api_cdr.sh")
out.write_text(script, encoding="utf-8", newline="\n")
print(f"Wrote {out} ({len(script)} bytes)")
