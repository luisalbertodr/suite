"""Genera repair_project_files.txt desde mscomctl.lfn (NO toca el .prg; esta en vfp/)."""
from __future__ import annotations

import re
from pathlib import Path

EXPORT = Path(r"C:\Duna\Export")
LFN = EXPORT / "mscomctl.lfn"
LIST = EXPORT / "PROGS" / "repair_project_files.txt"

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


def resolve_export_path(fname: str, folder: str) -> str | None:
    """Devuelve ruta relativa en Export si el fichero existe (fxp -> prg si hace falta)."""
    key = fname.lower()
    if key in PROG_MAP:
        rel = PROG_MAP[key].replace("/", "\\")
    else:
        rel = f"{folder}\\{fname}" if folder else fname
        rel = rel.replace("/", "\\")
        full = EXPORT / rel
        if not full.exists() and rel.lower().endswith(".fxp"):
            prg = (EXPORT / rel).with_suffix(".prg")
            if prg.exists():
                rel = str((EXPORT / rel).with_suffix(".prg").relative_to(EXPORT)).replace("/", "\\")
    full = EXPORT / rel
    if full.exists():
        return rel
    return None


def parse_lfn(text: str) -> tuple[list[str], list[str]]:
    out: list[str] = []
    missing: list[str] = []
    seen: set[str] = set()
    for line in text.splitlines():
        m = LINE_RE.match(line)
        if not m:
            continue
        fname, folder = m.group(1), m.group(2).strip("\\/").upper()
        rel = resolve_export_path(fname, folder)
        if rel is None:
            missing.append(f"{folder}\\{fname}" if folder else fname)
            continue
        if rel.lower() in seen:
            continue
        seen.add(rel.lower())
        out.append(rel)
    return out, missing


def main() -> None:
    if not LFN.exists():
        raise SystemExit(f"No existe {LFN}")
    files, missing = parse_lfn(LFN.read_text(encoding="latin1", errors="replace"))
    lines = [
        f"# generado desde {LFN.name}",
        f"# total {len(files)}",
        f"# ausentes en disco {len(missing)}",
    ] + files
    LIST.write_text("\n".join(lines) + "\n", encoding="latin1")
    print(f"OK {len(files)} archivos -> {LIST.name}")
    if missing:
        print(f"AVISO: {len(missing)} entradas LFN sin fichero en Export")


if __name__ == "__main__":
    main()
