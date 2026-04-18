"""
Parseo de ESTRUCTURA_COMPLETA_LIPOOUT.txt (reporte TABLA: X.DBF + columnas).
Usado por build_legacy_wave1_migration.py y build_legacy_wave2_migration.py.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

DEFAULT_STRUCT_TXT = r"E:\APP Lipoout\dbf\ESTRUCTURA_COMPLETA_LIPOOUT.txt"

# Oleada 1 (ya migrada): maestros + agenda + planificación + facturación base.
WAVE1_TABLES = frozenset(
    {
        "CLIENTES",
        "EMPLEADOS",
        "ARTICULOS",
        "AGENDA",
        "PLANINC",
        "BONOSCLI",
        "FACCAB",
        "FACLIN",
    }
)

# Orden estable del import oleada 1 (dependencias lógicas, aunque no hay FKs en legacy).
WAVE1_IMPORT_ORDER: list[tuple[str, str]] = [
    ("clientes", "CLIENTES.DBF"),
    ("empleados", "EMPLEADOS.DBF"),
    ("articulos", "ARTICULOS.DBF"),
    ("agenda", "AGENDA.DBF"),
    ("planinc", "PLANINC.DBF"),
    ("bonoscli", "BONOSCLI.DBF"),
    ("faccab", "FACCAB.DBF"),
    ("faclin", "FACLIN.DBF"),
]


def norm_col(name: str) -> str:
    n = name.strip().lower()
    if not re.match(r"^[a-z_][a-z0-9_]*$", n):
        raise ValueError(f"Nombre de columna no válido: {name!r}")
    return n


def parse_tables(txt: str) -> dict[str, list[str]]:
    """nombre_tabla_sin_ext (MAYÚSCULAS) -> columnas en orden (minúsculas)."""
    tables: dict[str, list[str]] = {}
    current: str | None = None
    cols: list[str] = []

    for line in txt.splitlines():
        m = re.match(r"^TABLA:\s*(\w+)\.DBF\s*$", line, re.I)
        if m:
            if current and cols:
                tables[current] = cols
            current = m.group(1).upper()
            cols = []
            continue
        if current is None:
            continue
        cm = re.match(r"^\s*-\s+(\w+)\s+\|\s+Tipo:", line)
        if cm:
            cols.append(norm_col(cm.group(1)))
            continue

    if current and cols:
        tables[current] = cols

    return tables


def load_tables_from_env() -> dict[str, list[str]]:
    path = Path(os.environ.get("STRUCTURA_TXT", DEFAULT_STRUCT_TXT))
    if not path.is_file():
        raise FileNotFoundError(str(path))
    return parse_tables(path.read_text(encoding="utf-8", errors="replace"))


def pg_table_name(dbf_table_upper: str) -> str:
    return dbf_table_upper.lower()
