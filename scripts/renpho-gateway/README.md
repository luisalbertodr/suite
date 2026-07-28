# Gateway MorphoScan (ble-scale-sync) → Suite scale-ingest
#
# Host: mail.lipoout.com (192.168.99.112), ruta /root/renpho-gateway/ble-scale-sync
#
# Instalar / actualizar continuo:
#   .\scripts\renpho-gateway\install-continuous.ps1
#
# El servicio systemd `ble-scale-sync` corre siempre (CONTINUOUS_MODE).
# Suite solo asigna cliente con «Pesar ahora»; no arranca el bridge.
#
# Requisitos: no usar la app Renpho Health a la vez en esa báscula.
# Tras instalar, `npm run validate` debe mostrar ≥1 exporter(s).
#
# Parche R-MSC04 (MorphoScan Nova) — body fat real + perfil «Pesar ahora»:
#   scripts/renpho-gateway/patches/renpho-msc04.ts
# Handshake + acks + frames 0x25/0x26. Si hay petición abierta en Suite,
# GET scale-ingest?pending=1 aporta altura/edad/sexo del paciente.
# Copiar a: /root/renpho-gateway/ble-scale-sync/src/scales/renpho-msc04.ts
# y reiniciar: systemctl restart ble-scale-sync
#
# Escaneo BLE casi continuo (parche loop.ts):
#   - Idle / timeout: reintenta en ~0.5s (no pausa de 60s)
#   - Error de conexión: backoff corto 2–5s (protege BlueZ)
#   - Tras un pesaje OK: cooldown 5s (mín. ~25s grace post-disconnect)
#
# Varias MorphoScan (mismo centro):
#   - No fijar ble.scale_mac → auto-discovery
#   - .env SCALE_MACS=MAC1,MAC2  (allowlist)
#   - Actual: 60:30:F2:74:26:E2 + 60:30:F2:74:22:B6
#   - Una sola cola «Pesar ahora» por company_id: la primera báscula que mida vincula
#   - El JSON lleva external_user_id=scale-<MAC> para distinguir unidades
