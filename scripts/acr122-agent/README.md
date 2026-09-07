# Agente ACR122U (ACS) para login NFC en Suite
#
# Arquitectura
# ------------
# 1. El navegador en Login crea un *challenge* ligado a `station_id`
#    (se guarda en localStorage del thin client / Mac).
# 2. Este agente lee el UID por PC/SC y lo envía a `nfc-auth` con
#    `NFC_AGENT_SECRET` + el mismo `NFC_STATION_ID`.
# 3. La Edge Function asocia UID → usuario, genera sesión Supabase y el
#    navegador la recoge por polling (`setSession`).
#
# Alternativa sin agente: ACR122U en **modo teclado (keyboard wedge)**.
# El Login captura el UID + Enter en un input oculto.
#
# RDP vs Chrome local
# -------------------
# - Chrome en thin client (USB local): corre el agente aquí, o usa modo teclado.
# - RDP: el agente debe correr donde esté el USB (thin client) **o** redirigir
#   el ACR122U al host RDP y correr el agente allí. El `station_id` del
#   navegador RDP debe coincidir con `NFC_STATION_ID` del agente.
#
# Instalación rápida (Debian)
# ---------------------------
#   sudo apt update
#   sudo apt install -y pcscd pcsc-tools libpcsclite1 python3-pyscard
#   sudo systemctl enable --now pcscd
#   # Comprueba: pcsc_scan
#
#   export NFC_AGENT_SECRET='(mismo que en supabase-project/.env)'
#   export NFC_STATION_ID='station-recepcion'
#   # En Chrome DevTools → Application → Local Storage → suite_nfc_station_id
#   # debe ser el mismo valor (o ábrelo una vez y cópialo).
#   python3 acr122_agent.py
#
# macOS
# -----
#   brew install pcsc-lite
#   pip3 install pyscard
#   # mismos exports y python3 acr122_agent.py
#
# Systemd (Debian thin client)
# ----------------------------
# Ver `acr122-agent.service`.
