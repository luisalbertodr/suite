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
# - RDP (recomendado en Recepción): el agente corre en el thin client Linux
#   (donde está el USB). Chrome en el Windows remoto solo hace polling.
#   El `station_id` del navegador RDP (`localStorage.suite_nfc_station_id`)
#   DEBE coincidir con `NFC_STATION_ID` del agente (p.ej. `station-recepcion`).
#
# IMPORTANTE — no mezclar con FreeRDP `/usb:id,dev:072f:2200`
# -----------------------------------------------------------
# Si xfreerdp redirige el ACR122U al Windows, libusb lo reclama en exclusivo:
#   - pcscd en Linux deja de ver lectores
#   - el agente local imprime "No hay lectores PC/SC" en bucle
#   - Windows 10 LTSC a menudo NO muestra el USB (RemoteFX/URBDRC) → el
#     dispositivo queda en un "agujero negro" (ni Linux ni Windows lo usan)
# Para Suite NFC: NO uses `/usb:...` ni Remmina USB redirect del ACR122U.
# Tampoco uses solo `/smartcard`: eso es para smartcards de login Windows,
# no para el UID NFC → Edge Function `nfc-auth`.
#
# Si ya se usó `/usb:id,dev:072f:2200`, el lector puede quedar colgado:
#   pcscd ve VID/PID pero falla con "Invalid frame" / LIBUSB_ERROR_TIMEOUT.
# Solución: quitar `/usb` del launcher, cerrar xfreerdp y **desenchufar/
# reenchufar** el ACR122U (reset USB software a veces no basta). Luego:
#   sudo systemctl restart pcscd acr122-agent
#   pcsc_scan   # debe listar "ACS ACR122U"
#
# Alternativa (más frágil): redirigir USB al host RDP, instalar drivers ACS
# en Windows y correr el agente allí (mismo `NFC_STATION_ID`).
##
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
