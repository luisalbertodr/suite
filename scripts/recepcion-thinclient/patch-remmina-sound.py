#!/usr/bin/env python3
from pathlib import Path

home = Path.home() / ".local/share/remmina"
if not home.is_dir():
    raise SystemExit(0)
for p in home.glob("*.remmina"):
    lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
    out = []
    seen_sound = False
    seen_mic = False
    for line in lines:
        if line.startswith("sound="):
            out.append("sound=local")
            seen_sound = True
        elif line.startswith("microphone="):
            out.append("microphone=local")
            seen_mic = True
        else:
            out.append(line)
    if not seen_sound:
        out.append("sound=local")
    if not seen_mic:
        out.append("microphone=local")
    p.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("patched", p.name)
