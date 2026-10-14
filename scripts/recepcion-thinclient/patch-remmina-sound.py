#!/usr/bin/env python3
"""Ajusta perfiles Remmina de recepción: audio local + estabilidad RDP."""
from pathlib import Path

# Clave Remmina → valor deseado (audio + menos stutter / reconexión)
PATCHES = {
    "sound": "local",
    "microphone": "local",
    # Calidad baja-media = menos ancho de banda y menos congelados en Wi‑Fi
    "quality": "1",
    "colordepth": "16",
    "disableclipboard": "0",
    # Evitar redirección USB del ACR122U (NFC queda en el thin client)
    "usb": "",
}

home = Path.home() / ".local/share/remmina"
if not home.is_dir():
    raise SystemExit(0)

for p in home.glob("*.remmina"):
    lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if "=" not in line or line.strip().startswith("#"):
            out.append(line)
            continue
        key, _, _ = line.partition("=")
        key = key.strip()
        if key in PATCHES:
            out.append(f"{key}={PATCHES[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, value in PATCHES.items():
        if key not in seen:
            out.append(f"{key}={value}")
    p.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("patched", p.name)
