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
BK="${{FILE}}.bak.$(date +%Y%m%d%H%M)"
cp "$FILE" "$BK"
TMP="${{FILE}}.new"
cat > "$TMP" << 'HEADER'
{header}HEADER
grep -E '^\\$(api_token_valido|db_user|db_pass|db_name)' "$BK" >> "$TMP"
echo '// -----------------------------------------------------------------' >> "$TMP"
base64 -d >> "$TMP" << 'END_BODY'
{body_b64}
END_BODY
php -l "$TMP" >/dev/null
mv "$TMP" "$FILE"
chmod 644 "$FILE"
echo "OK api_cdr.php actualizado (backup: $BK)"
TOKEN=$(grep '^\\$api_token_valido' "$FILE" | sed -E "s/^[^']*'([^']*)'.*/\\1/")
CALLUID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8888/api_cdr.php?from=2026-06-08&limit=20" | grep -oE '[0-9]+\\.[0-9]+' | head -1)
if [ -n "$CALLUID" ]; then
  CODE=$(curl -s -o /dev/null -w '%{{http_code}}' -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8888/api_cdr.php?format=wav&uniqueid=$CALLUID")
  echo "Smoke test wav uniqueid=$CALLUID -> HTTP $CODE"
fi
"""

out = pathlib.Path("tmp/apply-api_cdr.sh")
out.write_text(script, encoding="utf-8", newline="\n")
print(f"Wrote {out} ({len(script)} bytes)")
