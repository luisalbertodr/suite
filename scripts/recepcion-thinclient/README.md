# Thin client Recepción (MacBook Pro Linux Mint)

Host: `192.168.99.14` → FreeRDP fullscreen → VM Compaq `192.168.99.16` (usuario RDP `Compaq`).

## Estabilidad (desconexiones / pantalla congelada)

El launcher `rdp-recepcion.sh` aplica un perfil pensado para LAN/Wi‑Fi local:

| Flag / comportamiento | Para qué |
|----------------------|----------|
| `+auto-reconnect` + `/auto-reconnect-max-retries` | Recupera caídas de enlace sin cerrar la sesión |
| `/keepalive-interval` (default 20 s) | Evita cortes por idle / Wi‑Fi dormido |
| `/network:lan` (override `RDP_NETWORK`) | Timeouts/buffers de LAN; usa `wan` o `modem` si hay cortes graves |
| `/bpp:16` + `+compression` | Menos ancho de banda |
| `-wallpaper -menu-anims -window-drag -themes -fonts -aero` | Menos stutter visual |
| Bucle externo (`RDP_OUTER_RETRIES`) | Si FreeRDP sale con error, reabre la sesión |
| Log | `~/.local/share/rdp-recepcion.log` |

**No** activa `/gfx:AVC444` por defecto (suele provocar pausas de varios segundos en thin clients). Solo si hace falta:

```bash
RDP_GFX=rfx ~/bin/rdp-recepcion.sh
# o: RDP_GFX=avc444 ~/bin/rdp-recepcion.sh
```

Variables útiles:

```bash
RDP_NETWORK=wan              # Wi‑Fi inestable
RDP_KEEPALIVE_SEC=15
RDP_OUTER_RETRIES=30
RDP_OUTER_SLEEP_SEC=2
RDP_LOG=~/.local/share/rdp-recepcion.log
```

## Audio FreeRDP

- `/sound:sys:pulse` (o `alsa` si FreeRDP no tiene Pulse)
- `/microphone:sys:pulse`

**Importante:** hay que **cerrar y volver a abrir** la sesión FreeRDP para que el audio llegue al MacBook.

No añadir `/usb:...` del ACR122U: el agente NFC local usa el lector en Linux.

## Instalación rápida

```bash
mkdir -p ~/bin ~/.config ~/.local/share/applications ~/Escritorio
install -m 0755 rdp-recepcion.sh ~/bin/rdp-recepcion.sh
# Contraseña RDP (una línea, sin salto extra):
printf '%s' 'TU_PASS' > ~/.config/rdp-compaq.pass
chmod 600 ~/.config/rdp-compaq.pass
cp Recepcion.desktop ~/.local/share/applications/Recepción.desktop
cp Recepcion.desktop ~/Escritorio/Recepción.desktop
# Si usáis Remmina además del launcher:
python3 patch-remmina-sound.py
```

Tras actualizar el script: **cerrar la sesión RDP actual** y abrir de nuevo el icono «Recepción».

## Diagnóstico rápido

```bash
tail -50 ~/.local/share/rdp-recepcion.log
# Wi‑Fi floja → probar:
RDP_NETWORK=wan RDP_PASS_FILE=~/.config/rdp-compaq.pass ~/bin/rdp-recepcion.sh
```
