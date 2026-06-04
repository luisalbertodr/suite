#!/usr/bin/env python3
"""Busca en legacy.planinc las citas de la captura Dunasoft 11-jun-2026 Betha."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    k, v = k.strip(), v.strip().strip('"')
    if k and k not in os.environ:
        os.environ[k] = v

import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, str(ROOT / "scripts"))
from promote_legacy_planinc_to_agenda import (
    effective_planinc_date,
    effective_planinc_time,
    planinc_row_sort_key,
    norm_idplan,
)

TARGET = "2026-06-11"
CLIENTS = [
    "Maria Dolores Eiras",
    "Ana Fernandez Sanchez",
    "Maria Isabel Martinez Ares",
    "Raquel Lema Mira",
    "Raquel Casais Rodriguez",
    "Azlyn Antunes Ares",
    "Adrian Castelo",
]

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT * FROM legacy.planinc")
rows = cur.fetchall()

print("=== Busqueda por nombre (cualquier fecha, codemp 10) ===\n")
for needle in CLIENTS:
    hits = []
    for r in rows:
        nom = str(r.get("nomcli") or "").lower()
        if needle.lower()[:12] in nom:
            ce = str(r.get("codemp") or "").strip()
            if ce.lstrip("0") != "10":
                continue
            hits.append(r)
    print(f"--- {needle} (codemp 10): {len(hits)} filas ---")
    for r in sorted(hits, key=lambda x: (effective_planinc_date(x) or "", planinc_row_sort_key(x)))[-8:]:
        print(
            f"  fecha={effective_planinc_date(r)} fechax={r.get('fechax')} fecha={r.get('fecha')} "
            f"codemp={r.get('codemp')!r} idplan={r.get('idplan')} idplaninc={r.get('idplaninc')} "
            f"tipinc={r.get('tipinc')} {effective_planinc_time(r,'horini')}-{effective_planinc_time(r,'horfin')} "
            f"{str(r.get('nomcli') or '')[:40]}"
        )

print("\n=== Todas filas codemp 10 con fecha efectiva 2026-06-11 ===\n")
day10 = [r for r in rows if effective_planinc_date(r) == TARGET and str(r.get("codemp") or "").strip().lstrip("0") == "10"]
for r in sorted(day10, key=planinc_row_sort_key):
    print(
        f"  idplaninc={r.get('idplaninc')} idplan={r.get('idplan')} tipinc={r.get('tipinc')} "
        f"fecha={r.get('fecha')} fechax={r.get('fechax')} "
        f"{effective_planinc_time(r,'horini')} {str(r.get('nomcli') or '')[:40]}"
    )
print(f"Total: {len(day10)}")

print("\n=== Mismos clientes el 11-jun CUALQUIER codemp ===\n")
for needle in CLIENTS:
    hits = [r for r in rows if effective_planinc_date(r) == TARGET and needle.lower()[:12] in str(r.get("nomcli") or "").lower()]
    if not hits:
        continue
    print(f"--- {needle}: {len(hits)} ---")
    for r in sorted(hits, key=planinc_row_sort_key):
        print(
            f"  codemp={r.get('codemp')!r} idplan={r.get('idplan')} tipinc={r.get('tipinc')} "
            f"{effective_planinc_time(r,'horini')} {str(r.get('nomcli') or '')[:35]}"
        )

print("\n=== idplans captura: buscar 111316, horarios tarde codemp 10 ===\n")
# Maria Dolores was idplan 111316 at 14:00 under codemp 09 before
for ip in ("111316", "111256", "111226", "110811"):
    sub = [r for r in rows if norm_idplan(r.get("idplan")) == ip]
    if sub:
        print(f"IDPLAN {ip}: {len(sub)} filas")
        for r in sorted(sub, key=planinc_row_sort_key)[-5:]:
            print(
                f"  {effective_planinc_date(r)} codemp={r.get('codemp')} tipinc={r.get('tipinc')} "
                f"{effective_planinc_time(r,'horini')} fechax={r.get('fechax')} {str(r.get('nomcli') or '')[:30]}"
            )

cur.execute(
    """
    SELECT max(imported_at) AS at, import_batch, count(*)::bigint AS n
    FROM legacy.planinc GROUP BY import_batch ORDER BY at DESC LIMIT 3
    """
)
print("\nImport batches:", cur.fetchall())

dbf = Path(os.environ.get("LEGACY_DBF_DIR", "")) / "PLANINC.DBF"
if dbf.is_file():
    import datetime
    print(f"PLANINC.DBF mtime: {datetime.datetime.fromtimestamp(dbf.stat().st_mtime)}")

conn.close()
