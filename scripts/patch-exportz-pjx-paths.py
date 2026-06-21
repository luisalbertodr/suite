"""Parchea home directory del proyecto VFP Export -> ExportZ en .pjx/.pjt."""
from __future__ import annotations

import sys
from pathlib import Path

EXPORT = Path(r"C:\Duna\Export")
EXPORTZ = Path(r"C:\Duna\ExportZ")
STEM = "mscomctl"

REPLACEMENTS = [
    (b"C:\\Duna\\Export\\", b"C:\\Duna\\ExportZ\\"),
    (b"c:\\duna\\export\\", b"c:\\duna\\exportz\\"),
    (b"C:\\DUNA\\EXPORT\\", b"C:\\DUNA\\EXPORTZ\\"),
    (b"C:/Duna/Export/", b"C:/Duna/ExportZ/"),
    (b"c:/duna/export/", b"c:/duna/exportz/"),
]


def patch_file(path: Path) -> int:
    data = path.read_bytes()
    orig_len = len(data)
    for old, new in REPLACEMENTS:
        data = data.replace(old, new)
    if len(data) != orig_len:
        path.write_bytes(data)
        return 1
    return 0


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else EXPORTZ
    n = 0
    for ext in ("pjx", "pjt"):
        p = root / f"{STEM}.{ext}"
        if not p.exists():
            raise SystemExit(f"Falta {p}")
        before = p.read_bytes()
        patch_file(p)
        after = p.read_bytes()
        changed = before != after
        print(f"OK {p.name}: {'parcheado' if changed else 'sin cambios'} ({len(after)} bytes)")
        if changed:
            n += 1
    if n == 0:
        print("AVISO: no se encontraron rutas C:\\Duna\\Export\\ (quizá ya parcheado)")


if __name__ == "__main__":
    main()
