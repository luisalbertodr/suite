"""Limpia rutas basura del memo mscomctlOk.pjt (decompile ReFox). VFP cerrado."""
from __future__ import annotations

import re
import sys
from pathlib import Path

EXPORTZ = Path(r"C:\Duna\ExportZ")
STEM = "mscomctlOk"

PATH_RE = re.compile(rb"[A-Za-z]:\\[^\x00\r\n]{4,160}")


def is_bad_path(raw: bytes) -> bool:
    try:
        t = raw.decode("latin1")
    except UnicodeDecodeError:
        return True
    low = t.lower()
    if "style-dunasoft" in low:
        return True
    if low.startswith("z:") or low.startswith("y:"):
        return True
    if "c:\\users\\" in low and "temp" in low:
        return True
    if re.search(r"[^\x20-\x7e\\.\\\-_*]", t):
        return True
    return False


def scrub(data: bytearray) -> int:
    n = 0
    for m in PATH_RE.finditer(bytes(data)):
        if is_bad_path(m.group()):
            data[m.start() : m.end()] = b"\x00" * (m.end() - m.start())
            n += 1
    return n


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else EXPORTZ
    stem = sys.argv[2] if len(sys.argv) > 2 else STEM
    pjt = root / f"{stem}.pjt"
    if not pjt.exists():
        raise SystemExit(f"Falta {pjt}")
    bak = root / "backup_pjx" / f"{stem}-pre-scrub.pjt"
    bak.parent.mkdir(parents=True, exist_ok=True)
    raw = pjt.read_bytes()
    bak.write_bytes(raw)
    buf = bytearray(raw)
    n = scrub(buf)
    pjt.write_bytes(buf)
    print(f"OK {pjt.name}: {n} rutas basura neutralizadas (backup {bak})")


if __name__ == "__main__":
    main()
