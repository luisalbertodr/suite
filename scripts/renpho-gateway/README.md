# Gateway MorphoScan (ble-scale-sync) → Suite scale-ingest
#
# Host: mail.lipoout.com (192.168.99.112), ruta /root/renpho-gateway/ble-scale-sync
#
# Instalar / actualizar continuo:
#   .\scripts\renpho-gateway\install-continuous.ps1
#   .\scripts\renpho-gateway\install-continuous.ps1 -SshTarget suite-web
#
# El servicio systemd `ble-scale-sync` corre siempre (CONTINUOUS_MODE).
# Suite asigna cliente y báscula con «Pesar» / «Pesar+»; el bridge solo escanea BLE
# mientras haya petición abierta (modo idle/active, TTL 5 min).
#
# Requisitos: no usar la app Renpho Health a la vez en esa báscula.
# Tras instalar, `npm run validate` debe mostrar ≥1 exporter(s).
#
# Parches (install-continuous.ps1 los sube y aplica con apply-gateway-ble-fixes.py):
#   suite-pending.ts   — poll ?pending=1 + target_scale_mac
#   renpho-msc04.ts    — handshake BIA con perfil del paciente
#   loop.ts (parche)   — idle sin escaneo BLE hasta «Pesar»
#   discovery.ts       — conecta solo la MAC elegida (Pesar / Pesar+)
#
# Botones Suite:
#   «Pesar»   → 60:30:F2:74:26:E2 (Morpho, referencia)
#   «Pesar+»  → 60:30:F2:74:22:B6 (Morpho+3, ~+100–300 g en pesajes simultáneos)
#
# .env SCALE_MACS=MAC1,MAC2 (allowlist; ambas deben estar listadas)
