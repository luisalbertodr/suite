#!/usr/bin/env python3
"""Audit PK inference vs generadbc.prg canonical indexes — find broken tables."""

from __future__ import annotations

import re
import struct
from pathlib import Path

DBF_DIR = Path(r"C:\Duna\260603-Style-Dunasoft\dbf")
GENERADBC = Path(r"C:\Duna\Export\PROGS\generadbc.prg")
MIGRATION = Path(r"C:\Duna\DunaWeb\supabase\migrations\20260605120000_dunasoft_schema.sql")

PK_CANDIDATES = (
    "codcli",
    "codart",
    "codemp",
    "codpan",
    "codgru",
    "numgas",
    "numfac",
    "numtic",
    "idmenu",
    "numalb",
    "codpro",
    "codban",
    "codcue",
    "codigo",
    "id",
)


def read_dbf_fields(path: Path) -> list[str]:
    with path.open("rb") as f:
        f.seek(32)
        names = []
        while True:
            fd = f.read(32)
            if not fd or fd[0] == 0x0D:
                break
            names.append(fd[0:11].split(b"\x00")[0].decode("latin1").lower())
    return names


def infer_pk(fields: list[str]) -> list[str]:
    names = set(fields)
    for cand in PK_CANDIDATES:
        if cand in names:
            return [cand]
    if "numgas" in names and "lingas" in names:
        return ["numgas", "lingas"]
    if "numfac" in names and "linfac" in names:
        return ["numfac", "linfac"]
    return ["_row_id"]


def parse_generadbc_indexes() -> dict[str, list[tuple[str, str]]]:
    text = GENERADBC.read_text(encoding="latin1", errors="replace")
    tables: dict[str, list[tuple[str, str]]] = {}
    current = None
    for line in text.splitlines():
        m = re.match(r"PROCEDURE MakeTable_(\w+)", line, re.I)
        if m:
            current = m.group(1).lower()
            tables[current] = []
            continue
        if current and "INDEX ON" in line.upper():
            im = re.search(r"INDEX ON (.+?) TAG (\w+)", line, re.I)
            if im:
                tables[current].append((im.group(1).strip(), im.group(2).lower()))
    return tables


def pg_pk_from_migration(table: str) -> str | None:
    text = MIGRATION.read_text(encoding="utf-8", errors="replace")
    block = re.search(
        rf'CREATE TABLE IF NOT EXISTS dunasoft\.\"{re.escape(table)}\" \((.*?)\n\);',
        text,
        re.S | re.I,
    )
    if not block:
        return None
    body = block.group(1)
    m = re.search(r"PRIMARY KEY \(([^)]+)\)", body, re.I)
    if m:
        return m.group(1)
    if "_row_id BIGSERIAL PRIMARY KEY" in body:
        return "_row_id"
    return None


def main() -> None:
    indexes = parse_generadbc_indexes()
    dbfs = sorted({p.stem.lower() for p in DBF_DIR.glob("*.dbf")})

    # Canonical PK = first INDEX tag that matches field name or obvious id field
    canonical: dict[str, str] = {
        "plan2009": "idplan",
        "planinc": "idplaninc",
        "planart": "idplan+hora (or idplan+codart+hora)",
        "plansms": "idsms",
        "smsautoreg": "idplanreg",
        "cobros": "numcob",
        "carcli": "codcli+numfac+numrec (composite)",
        "faccab": "ejefac+serfac+numfac",
        "faclin": "ejefac+serfac+numfac+linfac",
        "bonoscli": "codcli+codboncli",
        "bonosart": "codbon+codart",
        "bonosart1": "codbon+codart",
        "bonosart2": "codboncli+codart",
        "clipeso": "codcli+fecha",
        "clitra": "idclitra",
        "clicav": "idclicav",
        "codpos": "_row_id (duplicate codpos keys)",
        "empfam": "codemp+codfam1",
        "empart": "codemp+codart",
        "bonosfam": "codbon+codfam1",
        "cbarras": "codart+codartdos",
        "tallasart": "codart+idgrupo+idtalla+idcolor",
        "galerias": "idfoto",
        "agendaart": "codage",
        "email": "_row_id",
        "remesas": "ejerem+serrem+idrem",
    }

    broken = []
    ok = []
    for table in dbfs:
        fields = read_dbf_fields(DBF_DIR / f"{table.upper()}.DBF")
        inferred = infer_pk(fields)
        pg = pg_pk_from_migration(table)
        first_idx = indexes.get(table, [("", "")])[0][1] if indexes.get(table) else ""
        issue = None
        if inferred == ["codcli"] and table in ("plan2009", "planinc", "plantmp"):
            issue = f"WRONG: uses codcli, Dunasoft PK index is {first_idx or canonical.get(table)}"
        elif inferred == ["codart"] and table in ("planart", "faclin", "faclinper", "faclintmp"):
            issue = f"WRONG: uses codart, Dunasoft uses composite index"
        elif inferred == ["numfac"] and table in ("cobros", "faccab", "carcli"):
            issue = f"WRONG: uses numfac only, Dunasoft uses {canonical.get(table, first_idx)}"
        elif inferred != ["_row_id"] and table in (
            "clipeso",
            "clitra",
            "clicav",
            "bonoscli",
            "bonosart2",
            "empfest",
            "codpos",
            "email",
            "cieentsal",
            "cielin",
        ):
            issue = f"LIKELY WRONG: inferred {inferred}, needs composite or _row_id"
        if issue:
            broken.append((table, issue, pg, inferred))
        else:
            ok.append(table)

    print(f"Tablas DBF: {len(dbfs)}")
    print(f"Probablemente OK (PK _row_id o maestro 1:1): {len(ok)}")
    print(f"Problemáticas (PK incorrecta → pierde filas): {len(broken)}\n")
    for t, issue, pg, inf in sorted(broken):
        print(f"  {t:16} PG={pg} inferred={inf}")
        print(f"    → {issue}")

    print("\n=== CRÍTICAS agenda/facturación ===")
    for t in ("plan2009", "planinc", "planart", "faccab", "faclin", "cobros", "carcli", "faclintmp"):
        fields = read_dbf_fields(DBF_DIR / f"{t.upper()}.DBF")
        print(
            f"{t}: inferred={infer_pk(fields)} pg={pg_pk_from_migration(t)} "
            f"indexes={[x[1] for x in indexes.get(t, [])[:4]]}"
        )


if __name__ == "__main__":
    main()
