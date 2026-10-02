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
head -8 "$HOME/bin/rdp-recepcion.sh"
grep -E 'Exec=|Comment=' "$HOME/.local/share/applications/Recepción.desktop"
ls -l "$HOME/bin/rdp-recepcion.sh" "$HOME/.config/rdp-compaq.pass"
xfreerdp /buildconfig 2>&1 | grep -iE 'PULSE|ALSA|SOUND' | head -20 || true
grep -E 'sound=|microphone=' "$HOME/.local/share/remmina/"*.remmina 2>/dev/null | head -20 || true
