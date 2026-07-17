# api_cdr.php (Issabel → Suite)

Fichero de referencia: `scripts/issabel/api_cdr.php`  
Destino en Issabel: `/var/www/html_api/api_cdr.php`

## Despliegue manual

En Issabel (`192.168.99.36`), como root.

### Instalación nueva (Issabel recién instalado)

Desde Windows (PowerShell en el repo):

```powershell
$env:SUITE_ISSABEL_SSH_PASSWORD = '...'
$env:ISSABEL_API_TOKEN = '...'   # mismo valor que ISSABEL_API_TOKEN en Supabase (110)
.\scripts\deploy-issabel-api-cdr.ps1
```

El script crea `/var/www/html_api/api_cdr.php`, lee `AMPDBPASS` de Issabel, configura Apache en el puerto **8888** y hace un smoke test.

Si no pasas `ISSABEL_API_TOKEN`, se genera uno aleatorio en Issabel: hay que copiarlo al `.env` de Supabase (`ISSABEL_API_TOKEN`) y reiniciar `supabase-edge-functions`.

### Actualización (ya existe api_cdr.php)

```bash
cp /var/www/html_api/api_cdr.php /var/www/html_api/api_cdr.php.bak.$(date +%Y%m%d)
```

Copia el contenido nuevo **conservando** al inicio del bloque de configuración:

- `$api_token_valido` (el que ya usa Suite en `.env` del Supabase)
- `$db_pass` real

O usa `.\scripts\deploy-issabel-api-cdr.ps1` (conserva token y credenciales del fichero remoto).

## Pruebas

Listado (debe incluir `recordingfile` y `linkedid`):

```bash
curl -s -H "Authorization: Bearer TU_TOKEN" \
  "http://127.0.0.1:8888/api_cdr.php?from=2026-06-01&limit=5" | head -c 500
```

Audio por uniqueid:

```bash
curl -s -D - -o /tmp/test.wav \
  -H "Authorization: Bearer TU_TOKEN" \
  "http://127.0.0.1:8888/api_cdr.php?format=wav&uniqueid=1780593561.132271"
file /tmp/test.wav
```

Audio por nombre de fichero (`recordingfile` del CDR):

```bash
curl -s -D - -o /tmp/test2.wav \
  -H "Authorization: Bearer TU_TOKEN" \
  "http://127.0.0.1:8888/api_cdr.php?file=rg-100-662584162-20260608-145040-1780923040.1437.wav"
file /tmp/test2.wav
```

## Notas

- Las grabaciones deben existir en `/var/spool/asterisk/monitor/` (campo `recordingfile` en `asteriskcdrdb.cdr`).
- Si `recordingfile` sigue vacío en la BD, activar grabación en Issabel/Asterisk (MixMonitor) para las rutas correspondientes.
- Suite ya llama a `?format=wav&uniqueid=...` vía la Edge Function `issabel-calls`.
