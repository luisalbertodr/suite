#!/usr/bin/env python3
"""
Auditoría exhaustiva PLANINC.DBF (local) vs legacy.planinc (Postgres) vs promoción.

Uso:
  python scripts/audit_planinc_dbf_vs_db.py --date 2026-06-11
  python scripts/audit_planinc_dbf_vs_db.py --date 2026-06-11 --codemp 10
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

import psycopg2
from dbfread import DBF
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from legacy_dbf_import_wave1 import iter_legacy_dbf_records, LenientFieldParser, load_dotenv
from promote_legacy_planinc_to_agenda import (
    effective_planinc_date,
    effective_planinc_time,
    planinc_row_sort_key,
    norm_idplan,
    exclude_tipinc_set,
)

ENV_PATH = ROOT / ".env"


def norm_date(value) -> str | None:
    v = str(value or "").strip()
    if len(v) == 8 and v.isdigit():
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}"
    if len(v) >= 10 and v[4] == "-":
        return v[:10]
    return None


def raw_date(r: dict, field: str) -> str | None:
    return norm_date(r.get(field) or r.get(field.upper()))


def row_dict_dbf(rec) -> dict:
    return {k.lower(): v for k, v in rec.items()}


def match_date(r: dict, target: str) -> bool:
    fx = raw_date(r, "fechax")
    f = raw_date(r, "fecha")
    eff = fx or f
    return eff == target or f == target or fx == target


def summarize_row(r: dict, source: str) -> dict:
    return {
        "source": source,
        "idplaninc": r.get("idplaninc"),
        "idplan": r.get("idplan"),
        "codemp": str(r.get("codemp") or "").strip(),
        "codempx": str(r.get("codempx") or "").strip() or None,
        "fecha": raw_date(r, "fecha"),
        "fechax": raw_date(r, "fechax"),
        "eff_date": effective_planinc_date(r) if "fechax" in r or "fecha" in r else (raw_date(r, "fechax") or raw_date(r, "fecha")),
        "horini": str(r.get("horini") or r.get("horinix") or "").strip()[:5],
        "tipinc": str(r.get("tipinc") or "").strip(),
        "nomcli": str(r.get("nomcli") or "")[:50],
    }


def scan_dbf(path: Path, encoding: str, target_date: str, codemp_filter: str | None) -> tuple[list[dict], int]:
    dbf = DBF(
        str(path),
        encoding=encoding,
        char_decode_errors="replace",
        parserclass=LenientFieldParser,
        ignore_missing_memofile=True,
    )
    out = []
    total = 0
    skipped_iter = 0
    for rec in iter_legacy_dbf_records(dbf):
        total += 1
        r = row_dict_dbf(rec)
        if not match_date(r, target_date):
            continue
        ce = str(r.get("codemp") or "").strip()
        cex = str(r.get("codempx") or "").strip()
        if codemp_filter:
            nf = codemp_filter.lstrip("0") or "0"
            if ce.lstrip("0") != nf and cex.lstrip("0") != nf:
                continue
        out.append(summarize_row(r, "dbf"))
    return out, total


def scan_pg(cur, target_date: str, codemp_filter: str | None) -> list[dict]:
    cur.execute("SELECT * FROM legacy.planinc")
    rows = cur.fetchall()
    out = []
    for r in rows:
        if effective_planinc_date(r) != target_date and raw_date(r, "fecha") != target_date and raw_date(r, "fechax") != target_date:
            continue
        ce = str(r.get("codemp") or "").strip()
        cex = str(r.get("codempx") or "").strip()
        if codemp_filter:
            nf = codemp_filter.lstrip("0") or "0"
            if ce.lstrip("0") != nf and cex.lstrip("0") != nf:
                continue
        out.append(summarize_row(r, "pg"))
    return out


def winners_for_day(rows: list[dict], use_codempx: bool) -> dict[str, dict]:
    """Simula ganador por idplan."""
    by_idplan: dict[str, tuple] = {}
    for r in rows:
        ip = norm_idplan(r.get("idplan"))
        if not ip:
            continue
        # reconstruir sort key mínimo
        sk = (int(r["idplaninc"]) if str(r.get("idplaninc") or "").isdigit() else 0,)
        prev = by_idplan.get(ip)
        if prev is None or sk > prev[0]:
            emp = r["codempx"] if use_codempx and r.get("codempx") else r["codemp"]
            by_idplan[ip] = (sk, {**r, "emp_used": emp})
    return {ip: v[1] for ip, v in by_idplan.items()}


def main() -> int:
    if ENV_PATH.is_file():
        load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default="2026-06-11")
    ap.add_argument("--codemp", default="")
    ap.add_argument("--dbf", default="")
    args = ap.parse_args()

    target = args.date.strip()
    codemp_f = (args.codemp or "").strip() or None
    dbf_dir = Path(os.environ.get("LEGACY_DBF_DIR", r"C:\Users\OportoW11\Suite\Dunasoft\dbf"))
    dbf_path = Path(args.dbf) if args.dbf else dbf_dir / "PLANINC.DBF"
    encoding = os.environ.get("LEGACY_DBF_ENCODING", "cp1252")
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        print("Falta SUPABASE_DB_URL", file=sys.stderr)
        return 2
    if not dbf_path.is_file():
        print(f"No existe {dbf_path}", file=sys.stderr)
        return 2

    print(f"PLANINC.DBF: {dbf_path}")
    print(f"  mtime: {dbf_path.stat().st_mtime}")
    print(f"  size:  {dbf_path.stat().st_size}")

    dbf_rows, dbf_total = scan_dbf(dbf_path, encoding, target, codemp_f)
    print(f"\nDBF registros activos totales (iterados): {dbf_total}")
    print(f"DBF filas fecha {target}" + (f" codemp~{codemp_f}" if codemp_f else "") + f": {len(dbf_rows)}")

    conn = psycopg2.connect(url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT COUNT(*) AS n FROM legacy.planinc")
    pg_all = cur.fetchone()["n"]
    pg_rows = scan_pg(cur, target, codemp_f)
    print(f"\nPostgres legacy.planinc total: {pg_all}")
    print(f"PG filas fecha {target}" + (f" codemp~{codemp_f}" if codemp_f else "") + f": {len(pg_rows)}")

    # Comparar por idplaninc
    dbf_ids = {str(r["idplaninc"]) for r in dbf_rows}
    pg_ids = {str(r["idplaninc"]) for r in pg_rows}
    only_dbf = dbf_ids - pg_ids
    only_pg = pg_ids - dbf_ids
    print(f"\nIDPLANINC solo en DBF: {len(only_dbf)}")
    print(f"IDPLANINC solo en PG:  {len(only_pg)}")

    if only_dbf:
        print("  Ejemplos solo DBF (max 15):")
        for r in dbf_rows:
            if str(r["idplaninc"]) in only_dbf:
                print(f"    {r}")
                if len([x for x in dbf_rows if str(x['idplaninc']) in only_dbf]) > 15:
                    break

    print("\n--- Detalle DBF ---")
    for r in sorted(dbf_rows, key=lambda x: (x.get("horini") or "", x.get("idplaninc") or 0)):
        print(r)

    print("\n--- Detalle PG ---")
    for r in sorted(pg_rows, key=lambda x: (x.get("horini") or "", x.get("idplaninc") or 0)):
        print(r)

    # Buscar clientes captura en DBF cualquier fecha jun 2026
    needles = [
        "Maria Dolores Eiras",
        "Ana Fernandez Sanchez",
        "Maria Isabel Martinez",
        "Raquel Lema Mira",
        "Raquel Casais Rodriguez",
        "Azlyn Antunes",
    ]
    print("\n--- Clientes captura en DBF (cualquier día jun 2026) ---")
    dbf = DBF(
        str(dbf_path),
        encoding=encoding,
        char_decode_errors="replace",
        parserclass=LenientFieldParser,
        ignore_missing_memofile=True,
    )
    for rec in iter_legacy_dbf_records(dbf):
        r = row_dict_dbf(rec)
        nom = str(r.get("nomcli") or "")
        if not any(n.lower()[:14] in nom.lower() for n in needles):
            continue
        fx = raw_date(r, "fechax")
        f = raw_date(r, "fecha")
        if not (str(fx or f or "").startswith("2026-06")):
            continue
        print(
            f"  {fx or f} codemp={r.get('codemp')!r} codempx={r.get('codempx')!r} "
            f"{str(r.get('horini') or '')[:5]} idplan={r.get('idplan')} idplaninc={r.get('idplaninc')} "
            f"tipinc={r.get('tipinc')} {nom[:40]}"
        )

    # Conteo por fecha efectiva vs fecha cruda en PG para jun 11
    cur.execute("SELECT * FROM legacy.planinc")
    all_pg = cur.fetchall()
    jun11_fecha_only = []
    jun11_fechax_only = []
    jun11_eff = []
    for r in all_pg:
        f = raw_date(r, "fecha")
        fx = raw_date(r, "fechax")
        eff = effective_planinc_date(r)
        if f == target:
            jun11_fecha_only.append(r)
        if fx == target:
            jun11_fechax_only.append(r)
        if eff == target:
            jun11_eff.append(r)
    print(f"\nPG filas con fecha={target}: {len(jun11_fecha_only)}")
    print(f"PG filas con fechax={target}: {len(jun11_fechax_only)}")
    print(f"PG filas effective_date={target}: {len(jun11_eff)}")

    # Filas donde fecha y fechax difieren y afectan al día
    mism = []
    for r in all_pg:
        f = raw_date(r, "fecha")
        fx = raw_date(r, "fechax")
        if f and fx and f != fx and (f == target or fx == target):
            mism.append(r)
    print(f"PG filas fecha!=fechax tocando {target}: {len(mism)}")
    for r in mism[:20]:
        print(
            f"  idplaninc={r.get('idplaninc')} fecha={r.get('fecha')} fechax={r.get('fechax')} "
            f"eff={effective_planinc_date(r)} codemp={r.get('codemp')} {str(r.get('nomcli') or '')[:30]}"
        )

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
