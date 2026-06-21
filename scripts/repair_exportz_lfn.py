"""Genera repair_project_files.txt desde mscomctlOk.lfn en ExportZ."""
from __future__ import annotations

import re
import sys
from pathlib import Path

DEFAULT_ROOT = Path(r"C:\Duna\ExportZ")
DEFAULT_LFN = "mscomctlOk.lfn"

LINE_RE = re.compile(
    r'^\s*M?\s*"([^"]+)"\s+"[^"]*"\s+(\S+)\\?\s*$',
    re.IGNORECASE,
)

PROG_MAP = {
    "general.fxp": "PROGS/general.prg",
    "funciones.fxp": "PROGS/funciones.prg",
    "config.fxp": "PROGS/config.prg",
    "interficie.fxp": "PROGS/interficie.prg",
    "errorwe.fxp": "PROGS/errorwe.prg",
    "clases.fxp": "PROGS/clases.prg",
    "cerrar.fxp": "PROGS/cerrar.prg",
}


def resolve_path(root: Path, fname: str, folder: str) -> str | None:
    key = fname.lower()
    if key in PROG_MAP:
        rel = PROG_MAP[key].replace("/", "\\")
    else:
        rel = f"{folder}\\{fname}" if folder else fname
        rel = rel.replace("/", "\\")
        if not (root / rel).exists() and rel.lower().endswith(".fxp"):
            prg = (root / rel).with_suffix(".prg")
            if prg.exists():
                rel = str(prg.relative_to(root)).replace("/", "\\")
    if (root / rel).exists():
        return rel
    return None


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROOT
    lfn_name = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_LFN
    lfn = root / lfn_name
    if not lfn.exists():
        raise SystemExit(f"No existe {lfn}")
    out: list[str] = []
    missing: list[str] = []
    seen: set[str] = set()
    text = lfn.read_text(encoding="latin1", errors="replace")
    for line in text.splitlines():
        m = LINE_RE.match(line)
        if not m:
            continue
        fname, folder = m.group(1), m.group(2).strip("\\/").upper()
        rel = resolve_path(root, fname, folder)
        if rel is None:
            missing.append(f"{folder}\\{fname}" if folder else fname)
            continue
        key = rel.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(rel)
    dest = root / "PROGS" / "repair_project_files.txt"
    lines = [
        f"# desde {lfn.name} en {root}",
        f"# total {len(out)}",
        f"# ausentes {len(missing)}",
    ] + out
    dest.write_text("\n".join(lines) + "\n", encoding="latin1")
    print(f"OK {len(out)} archivos -> {dest}")
    if missing:
        print(f"AVISO: {len(missing)} sin fichero en {root}")


if __name__ == "__main__":
    main()
