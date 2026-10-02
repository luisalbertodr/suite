# Thin client Recepción (MacBook Pro Linux Mint)

## Audio FreeRDP

El launcher `rdp-recepcion.sh` habilita:

- `/sound:sys:pulse` (o `alsa` si FreeRDP no tiene Pulse)
- `/microphone:sys:pulse`

**Importante:** hay que **cerrar y volver a abrir** la sesión FreeRDP para que el audio llegue al MacBook.

No añadir `/usb:...` del ACR122U: el agente NFC local usa el lector en Linux.

## Instalación rápida

```bash
mkdir -p ~/bin ~/.config
install -m 0755 rdp-recepcion.sh ~/bin/rdp-recepcion.sh
# Contraseña RDP (una línea, sin salto extra):
printf '%s' 'TU_PASS' > ~/.config/rdp-compaq.pass
chmod 600 ~/.config/rdp-compaq.pass
cp Recepcion.desktop ~/.local/share/applications/Recepción.desktop
cp Recepcion.desktop ~/Escritorio/Recepción.desktop
```
