#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$HOME/bin" "$HOME/.config" "$HOME/.local/share/applications" "$HOME/Escritorio"
install -m 0755 /tmp/rdp-recepcion.sh "$HOME/bin/rdp-recepcion.sh"
# Keep existing password if present; otherwise seed from legacy desktop /p:l
if [[ ! -s "$HOME/.config/rdp-compaq.pass" ]]; then
  printf '%s' 'l' > "$HOME/.config/rdp-compaq.pass"
fi
chmod 600 "$HOME/.config/rdp-compaq.pass"
cp /tmp/Recepcion.desktop "$HOME/.local/share/applications/Recepción.desktop"
cp /tmp/Recepcion.desktop "$HOME/Escritorio/Recepción.desktop"
python3 /tmp/patch-remmina-sound.py || true
echo VERIFY
grep -E 'auto-reconnect|keepalive|network:|OUTER_RETRIES|bpp:16' "$HOME/bin/rdp-recepcion.sh" | head -20
grep -E 'Exec=|Comment=' "$HOME/.local/share/applications/Recepción.desktop"
ls -l "$HOME/bin/rdp-recepcion.sh" "$HOME/.config/rdp-compaq.pass"
xfreerdp /buildconfig 2>&1 | grep -iE 'PULSE|ALSA|SOUND' | head -20 || true
xfreerdp /help 2>&1 | grep -iE 'auto-reconnect|keepalive|network' | head -20 || true
grep -E 'sound=|microphone=|quality=|colordepth=' "$HOME/.local/share/remmina/"*.remmina 2>/dev/null | head -30 || true
echo "Log: $HOME/.local/share/rdp-recepcion.log (tras primera conexión)"
