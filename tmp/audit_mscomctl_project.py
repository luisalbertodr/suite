"""Compara mscomctl.lfn vs disco vs repair_project_files.txt vs proyecto actual."""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

EXPORT = Path(r"C:\Duna\Export")
LFN = EXPORT / "mscomctl.lfn"
LIST = EXPORT / "PROGS" / "repair_project_files.txt"
PJX = EXPORT / "mscomctl.pjx"
BACKUP = EXPORT / "backup_pjx"

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


def lfn_to_rel(fname: str, folder: str) -> str:
    key = fname.lower()
    if key in PROG_MAP:
        rel = PROG_MAP[key]
    else:
        rel = f"{folder}\\{fname}" if folder else fname
    return rel.replace("/", "\\")


def parse_lfn(text: str) -> tuple[list[str], list[str], list[str]]:
    all_entries: list[str] = []
    present: list[str] = []
    missing: list[str] = []
    seen: set[str] = set()
    for line in text.splitlines():
        m = LINE_RE.match(line)
        if not m:
            continue
        fname, folder = m.group(1), m.group(2).strip("\\/").upper()
        rel = lfn_to_rel(fname, folder)
        all_entries.append(rel)
        key = rel.lower()
        if key in seen:
            continue
        seen.add(key)
        if (EXPORT / rel).exists():
            present.append(rel)
        else:
            missing.append(rel)
    return all_entries, present, missing


def read_list() -> list[str]:
    if not LIST.exists():
        return []
    return [
        ln.strip()
        for ln in LIST.read_text(encoding="latin1", errors="replace").splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]


def scan_pjx_strings(path: Path) -> set[str]:
    if not path.exists():
        return set()
    data = path.read_bytes()
    found: set[str] = set()
    for m in re.finditer(rb"[\x20-\x7e]{4,260}\.(?:prg|fxp|vcx|scx|frx|lbx|mnx|pjx|dbf|cdx|fpt|bmp|png|ico|cur|gif|jpg|jpeg|msk|vcf|vct|sct|sca|frt|lbt|mnt|pjt)", data, re.I):
        s = m.group(0).decode("latin1", errors="replace").lower()
        found.add(s)
    return found


def main() -> None:
    lfn_text = LFN.read_text(encoding="latin1", errors="replace")
    all_e, present, missing = parse_lfn(lfn_text)
    list_lines = read_list()

    print("=== Resumen ===")
    print(f"LFN lineas parseadas:     {len(all_e)}")
    print(f"LFN unicos:               {len(set(x.lower() for x in all_e))}")
    print(f"LFN unicos en disco:      {len(present)}")
    print(f"LFN unicos FALTAN disco:  {len(missing)}")
    print(f"repair_project_files.txt: {len(list_lines)}")
    print(f"mscomctl.pjx bytes:       {PJX.stat().st_size if PJX.exists() else 0}")

    prg_missing = [m for m in missing if m.lower().endswith(".prg")]
    fxp_missing = [m for m in missing if m.lower().endswith(".fxp")]
    print(f"\nFaltan en disco: .prg={len(prg_missing)} .fxp={len(fxp_missing)}")

    print("\n=== Top carpetas con archivos LFN ausentes en disco ===")
    c = Counter(
        m.split("\\")[0].upper() if "\\" in m else "(root)"
        for m in missing
    )
    for k, v in c.most_common(20):
        print(f"  {k}: {v}")

    print("\n=== PRG del LFN que NO estan en C:\\Duna\\Export (primeros 50) ===")
    for m in prg_missing[:50]:
        print(f"  {m}")

    list_set = {x.lower() for x in list_lines}
    missing_not_in_list = [m for m in missing if m.lower() not in list_set]
    print(f"\nAusentes en disco pero tampoco en lista repair: {len(missing_not_in_list)}")

    pjx_refs = scan_pjx_strings(PJX)
    prg_present = [p for p in present if p.lower().endswith(".prg")]
    in_pjx = [p for p in prg_present if Path(p).name.lower() in pjx_refs or p.lower() in pjx_refs]
    not_in_pjx = [p for p in prg_present if p not in in_pjx and Path(p).name.lower() not in pjx_refs]
    print(f"\nPRG en disco (LFN): {len(prg_present)}")
    print(f"PRG con nombre visible en pjx (heuristica): {len(in_pjx)}")
    print(f"PRG en disco pero nombre NO hallado en pjx (heuristica): {len(not_in_pjx)}")
    if not_in_pjx[:30]:
        print("  muestra:")
        for p in not_in_pjx[:30]:
            print(f"    {p}")

    print("\n=== Archivos LFN ausentes en disco (18 .fxp u otros) ===")
    for m in missing[:30]:
        print(f"  {m}")

    print("\n=== FXP del LFN sin .prg ni .fxp en PROGS ===")
    fxp_names = sorted(
        {
            m.group(1)
            for m in re.finditer(r'"([^"]+\.fxp)"', lfn_text, re.I)
        }
    )
    for fname in fxp_names:
        stem = Path(fname).stem
        prg = EXPORT / "PROGS" / f"{stem}.prg"
        fxp = EXPORT / "PROGS" / fname
        if not prg.exists() and not fxp.exists():
            print(f"  {fname}")

    if BACKUP.exists():
        backups = sorted(BACKUP.glob("*.pjx"), key=lambda p: p.stat().st_size, reverse=True)
        if backups:
            b = backups[0]
            brefs = scan_pjx_strings(b)
            print(f"\nBackup pjx mas grande: {b.name} ({b.stat().st_size} bytes)")
            print(f"  refs heuristica: {len(brefs)} vs actual {len(pjx_refs)}")


if __name__ == "__main__":
    main()
