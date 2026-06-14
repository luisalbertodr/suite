"""Compara archivos en mscomctl.pjx vs repair_project_files.txt."""
from __future__ import annotations

from pathlib import Path

from dbfread import DBF

EXPORT = Path(r"C:\Duna\Export")
PJX = EXPORT / "mscomctl.pjx"
LIST = EXPORT / "PROGS" / "repair_project_files.txt"


def norm(p: str) -> str:
    return p.replace("/", "\\").strip().lower()


def read_list() -> list[str]:
    return [
        ln.strip()
        for ln in LIST.read_text(encoding="latin1", errors="replace").splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]


def read_pjx_names() -> list[str]:
    names: list[str] = []
    for rec in DBF(str(PJX), ignore_missing_memofile=True, encoding="latin1"):
        name = rec.get("NAME")
        if not name:
            continue
        names.append(str(name).strip())
    return names


def main() -> None:
    listed = read_list()
    in_pjx = read_pjx_names()

    list_set = {norm(x) for x in listed}
    pjx_set = {norm(x) for x in in_pjx}

    missing_in_pjx = sorted(list_set - pjx_set)
    extra_in_pjx = sorted(pjx_set - list_set)

    print(f"Lista repair: {len(listed)}")
    print(f"Entradas pjx NAME: {len(in_pjx)}")
    print(f"En lista pero NO en pjx: {len(missing_in_pjx)}")
    print(f"En pjx pero NO en lista: {len(extra_in_pjx)}")

    prg_miss = [m for m in missing_in_pjx if m.endswith(".prg")]
    scx_miss = [m for m in missing_in_pjx if m.endswith(".scx")]
    vcx_miss = [m for m in missing_in_pjx if m.endswith(".vcx")]
    print(f"\nFaltan en pjx: prg={len(prg_miss)} scx={len(scx_miss)} vcx={len(vcx_miss)}")

    print("\n=== PRG en lista pero no en pjx ===")
    for m in prg_miss:
        print(f"  {m}")

    print("\n=== Primeros 40 SCX faltantes ===")
    for m in scx_miss[:40]:
        print(f"  {m}")

    print("\n=== Primeros 30 VCX faltantes ===")
    for m in vcx_miss[:30]:
        print(f"  {m}")

    from collections import Counter

    c = Counter(m.split("\\")[0] if "\\" in m else "(root)" for m in missing_in_pjx)
    print("\n=== Carpetas mas afectadas (faltan en pjx) ===")
    for k, v in c.most_common(15):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
