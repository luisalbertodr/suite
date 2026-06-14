"""Compara KEY en mscomctl.pjx vs lista repair."""
from __future__ import annotations

from collections import Counter
from pathlib import Path

from dbfread import DBF

EXPORT = Path(r"C:\Duna\Export")
PJX = EXPORT / "mscomctl.pjx"
BACKUP = EXPORT / "backup_pjx" / "mscomctl-20260613.pjx"
LIST = EXPORT / "PROGS" / "repair_project_files.txt"

TYPE_LABEL = {
    "H": "header",
    "V": "vcx",
    "K": "scx",
    "P": "prg",
    "M": "menu",
    "x": "bitmap/other",
    "T": "text/other",
}


def read_list() -> set[str]:
    keys: set[str] = set()
    for ln in LIST.read_text(encoding="latin1", errors="replace").splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("#"):
            continue
        base = Path(ln.replace("/", "\\")).stem.upper()
        keys.add(base)
    return keys


def read_pjx_keys(path: Path) -> tuple[list[tuple[str, str]], Counter]:
    rows: list[tuple[str, str]] = []
    types: Counter = Counter()
    for rec in DBF(str(path), ignore_missing_memofile=True, encoding="latin1"):
        key = rec.get("KEY")
        typ = rec.get("TYPE") or "?"
        if key:
            rows.append((str(typ), str(key).strip().upper()))
        types[str(typ)] += 1
    return rows, types


def main() -> None:
    list_keys = read_list()
    rows, types = read_pjx_keys(PJX)

    pjx_keys = {k for _, k in rows}
    missing = sorted(list_keys - pjx_keys)
    extra = sorted(pjx_keys - list_keys)

    print(f"=== mscomctl.pjx ({PJX.stat().st_size} bytes) ===")
    print(f"Registros: {sum(types.values())}")
    for t, n in sorted(types.items(), key=lambda x: -x[1]):
        print(f"  {t} ({TYPE_LABEL.get(t, '?')}): {n}")

    print(f"\nLista repair (stems unicos): {len(list_keys)}")
    print(f"KEY en pjx: {len(pjx_keys)}")
    print(f"En lista pero NO en pjx KEY: {len(missing)}")
    print(f"En pjx pero NO en lista: {len(extra)}")

    # classify missing by extension in list
    list_lines = [
        ln.strip()
        for ln in LIST.read_text(encoding="latin1", errors="replace").splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    miss_paths = [ln for ln in list_lines if Path(ln).stem.upper() in missing]
    ext_c = Counter(Path(p).suffix.lower() for p in miss_paths)
    print("\nExtensiones faltantes:")
    for ext, n in ext_c.most_common():
        print(f"  {ext or '(none)'}: {n}")

    print("\nPrimeros 30 stems faltantes:")
    for m in missing[:30]:
        print(f"  {m}")

    if BACKUP.exists():
        try:
            brows, btypes = read_pjx_keys(BACKUP)
            bpjx_keys = {k for _, k in brows}
            print(f"\n=== backup {BACKUP.name} ({BACKUP.stat().st_size} bytes) ===")
            print(f"Registros: {sum(btypes.values())}")
            for t, n in sorted(btypes.items(), key=lambda x: -x[1]):
                print(f"  {t}: {n}")
            print(f"KEY backup: {len(bpjx_keys)}")
            print(f"En lista pero NO en backup: {len(list_keys - bpjx_keys)}")
        except Exception as exc:
            print(f"\nBackup no legible: {exc}")


if __name__ == "__main__":
    main()
