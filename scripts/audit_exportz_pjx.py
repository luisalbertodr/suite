"""Lista referencias sospechosas en mscomctlOk.pjt (ExportZ). Ejecutar con VFP cerrado."""
from __future__ import annotations

import re
import sys
from pathlib import Path

EXPORTZ = Path(r"C:\Duna\ExportZ")
BAD = re.compile(
    rb"visual foxpro projects\\|"
    rb"[\x00-\x08\x0b\x0c\x0e-\x1f]",
    re.IGNORECASE,
)


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else EXPORTZ
    pjt = next(root.glob("mscomctl*.pjt"), None)
    if not pjt:
        raise SystemExit(f"No hay .pjt en {root}")
    data = pjt.read_bytes()
    hits = list(BAD.finditer(data))
    print(f"Archivo: {pjt}")
    print(f"Bytes: {len(data)}")
    print(f"Patrones corruptos encontrados: {len(hits)}")
    for i, m in enumerate(hits[:40]):
        start = max(0, m.start() - 60)
        end = min(len(data), m.end() + 60)
        chunk = data[start:end]
        safe = chunk.decode("latin1", errors="replace").replace("\r", " ").replace("\n", " ")
        print(f"  [{i+1}] ...{safe}...")
    if len(hits) > 40:
        print(f"  ... y {len(hits) - 40} mas")
    if hits:
        print("\nAccion: cierra VFP y ejecuta DO PROGS\\RepararProyectoSilent.prg")


if __name__ == "__main__":
    main()
