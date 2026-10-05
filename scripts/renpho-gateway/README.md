# Gateway MorphoScan (ble-scale-sync) → Suite scale-ingest
#
# Host: mail.lipoout.com (192.168.99.112), ruta /root/renpho-gateway/ble-scale-sync
#
# Instalar / actualizar:
#   .\scripts\renpho-gateway\install-continuous.ps1
#   .\scripts\renpho-gateway\install-continuous.ps1 -SshTarget suite-web
#
# Modo on-demand:
#   suite-ble-ondemand.service (siempre) hace poll a scale-ingest ?pending=1 cada 5s.
#   Al detectar «Pesar» → systemctl start/restart ble-scale-sync (proceso fresco).
#   Tras 10 min sin pending → systemctl stop ble-scale-sync.
#   ble-scale-sync NO arranca en boot.
#
# Requisitos: no usar la app Renpho Health a la vez en esa báscula.
# Tras instalar, `npm run validate` debe mostrar ≥1 exporter(s).
#
# Parches (install-continuous.ps1 los sube y aplica con apply-gateway-ble-fixes.py):
#   suite-pending.ts   — poll ?pending=1 + target_scale_mac + expires_at + expect por MAC
#   renpho-msc04.ts    — BIA preferido; weight-only solo al borde TTL / fin de «Pesar»
#   loop.ts (parche)   — idle sin escaneo BLE hasta «Pesar» o flush weight-only
#   discovery.ts       — MAC objetivo + flush MAC si pending cerró con peso stashed
#
# Fiabilidad (host Supabase .110):
#   /usr/local/bin/suite-scale-ingest-watchdog.sh  (cron * * * *)
#
# Fiabilidad (gateway BLE .112):
#   suite-ble-ondemand.service — lifecycle start/stop
#   systemd WatchdogSec=120 en ble-scale-sync — event loop congelado
#   /usr/local/bin/suite-ble-gateway-watchdog.sh  (cron * * * *) — hung scan
#
# Botón Suite «Pesar» (sin MAC fija):
#   target_scale_mac = null → el gateway escucha ambas vía SCALE_MACS.
#   Unidades: 60:30:F2:74:22:B6 y 60:30:F2:74:26:E2
#
# .env SCALE_MACS=MAC1,MAC2 (allowlist; ambas deben estar listadas)
