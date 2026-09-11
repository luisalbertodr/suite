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
# - RDP (recomendado): el agente corre en el thin client (donde está el USB).
#   Chrome en el Windows remoto solo hace polling.
#   El `station_id` del navegador RDP (`localStorage.suite_nfc_station_id`)
#   DEBE coincidir con `NFC_STATION_ID` del agente.
#
# Estaciones Lipoout (2 terminales físicos → 1 VM Windows compartida)
# -------------------------------------------------------------------
# Cada thin client tiene su propio ACR122U + agente + station_id.
# En la VM (192.168.99.16) cada usuario RDP abre Chrome con SU station:
#
# | Puesto     | Thin client        | IP             | Usuario RDP | NFC_STATION_ID      | Favorito Chrome                          |
# |------------|--------------------|----------------|-------------|---------------------|------------------------------------------|
# | Recepción  | MacBookPro + Mint  | 192.168.99.14  | Compaq / l  | station-recepcion   | https://suite.lipoout.com/?nfc_station=station-recepcion |
# | Medicina   | iMac               | 192.168.99.30  | Lipoout / l | station-medicina    | https://suite.lipoout.com/?nfc_station=station-medicina  |
#
# Misma `NFC_AGENT_SECRET` en ambos agentes (la del servidor Supabase).
# NO redirigir el USB del ACR122U por FreeRDP (`/usb:...`).
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
