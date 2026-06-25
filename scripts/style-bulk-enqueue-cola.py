#!/usr/bin/env python3
"""Encola plan2009 en cola_sincro.dbf (backfill outbound v2).

Uso:
  python scripts/style-bulk-enqueue-cola.py --style-root C:\\Duna\\Style-Suite-Test
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

import dbf
from dbfread import DBF


def sfield(rec: dict, name: str) -> str:
    v = rec.get(name)
    if v is None:
        return ""
    if isinstance(v, (bytes, bytearray)):
        return v.decode("latin-1", errors="replace").strip()
    if isinstance(v, date) and not isinstance(v, datetime):
        return v.isoformat()
    return str(v).strip()


def latin1_safe(val: str) -> str:
    if not isinstance(val, str):
        val = str(val)
    return val.encode("cp1252", errors="replace").decode("cp1252")


def parse_idplan(rec: dict) -> int:
    try:
        return int(float(sfield(rec, "IDPLAN") or "0"))
    except ValueError:
        return 0


def parse_fecha(rec: dict) -> date | None:
    v = rec.get("FECHA")
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    raw = sfield(rec, "FECHA")
    if len(raw) == 8 and raw.isdigit():
        return date(int(raw[0:4]), int(raw[4:6]), int(raw[6:8]))
    if len(raw) >= 10 and raw[4] == "-":
        try:
            return date.fromisoformat(raw[:10])
        except ValueError:
            return None
    return None


def safe_num(rec: dict, name: str) -> int:
    v = rec.get(name)
    if isinstance(v, (int, float)):
        return int(v)
    raw = sfield(rec, name)
    if not raw or not raw.strip("\x00 "):
        return 0
    try:
        return int(float(raw))
    except ValueError:
        return 0


def truthy(rec: dict, name: str) -> bool:
    return sfield(rec, name).upper() in ("T", "Y", "1", "TRUE")


def build_servicios_index(planart_path: Path) -> dict[int, list[str]]:
    idx: dict[int, list[str]] = {}
    if not planart_path.is_file():
        return idx
    for rec in DBF(str(planart_path), encoding="latin-1", ignore_missing_memofile=True, raw=True):
        try:
            rid = int(float(sfield(rec, "IDPLAN") or "0"))
        except ValueError:
            continue
        if rid <= 0:
            continue
        idx.setdefault(rid, []).append(sfield(rec, "CODART") + sfield(rec, "HORA"))
    return idx


def servicios_for(idx: dict[int, list[str]], idplan: int) -> str:
    return "\r".join(idx.get(idplan, []))[:254]


COLA_SPEC = (
    "id N(10,0); "
    "tabla C(40); "
    "id_reg C(30); "
    "accion C(3); "
    "procesado L; "
    "creado C(19); "
    "codemp C(15); "
    "codcli C(15); "
    "fecha D; "
    "fechaiso C(10); "
    "horini C(5); "
    "horfin C(5); "
    "texto C(250); "
    "codrec C(15); "
    "nomcli C(80); "
    "tel1cli C(20); "
    "facturado L; "
    "servicios C(254); "
    "colfon N(10,0); "
    "collet N(10,0); "
    "modif C(20); "
    "version N(15,0)"
)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--style-root", default=r"C:\Duna\Style-Suite-Test")
    ap.add_argument("--from-date", help="YYYY-MM-DD minimo")
    ap.add_argument("--include-facturado", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.style_root)
    plan_path = root / "dbf" / "plan2009.dbf"
    planart_path = root / "dbf" / "planart.dbf"
    cola_path = root / "cola_sincro.dbf"
    if not plan_path.is_file():
        print(f"ERROR: no existe {plan_path}", file=sys.stderr)
        return 1

    min_date = date.fromisoformat(args.from_date) if args.from_date else None
    planart_idx = build_servicios_index(planart_path)
    now = datetime.now()
    version = int(now.timestamp())
    rows: list[dict] = []
    skipped = 0

    for rec in DBF(str(plan_path), encoding="latin-1", ignore_missing_memofile=True, raw=True):
        idplan = parse_idplan(rec)
        if idplan <= 0 or idplan == 999999992:
            skipped += 1
            continue
        if not args.include_facturado and truthy(rec, "FACTURADO"):
            skipped += 1
            continue
        ld = parse_fecha(rec)
        if min_date and ld and ld < min_date:
            skipped += 1
            continue
        fecha_iso = ld.isoformat() if ld else ""
        rows.append(
            {
                "id": len(rows) + 1,
                "tabla": "plan2009",
                "id_reg": str(idplan),
                "accion": "UPD",
                "procesado": False,
                "creado": now.strftime("%Y-%m-%d %H:%M:%S"),
                "codemp": latin1_safe(sfield(rec, "CODEMP")),
                "codcli": latin1_safe(sfield(rec, "CODCLI")),
                "fecha": ld,
                "fechaiso": fecha_iso,
                "horini": latin1_safe((sfield(rec, "HORINI") or "09:00")[:5]),
                "horfin": latin1_safe((sfield(rec, "HORFIN") or "10:00")[:5]),
                "texto": latin1_safe(sfield(rec, "TEXTO")[:250]),
                "codrec": latin1_safe(sfield(rec, "CODREC")),
                "nomcli": latin1_safe(sfield(rec, "NOMCLI")),
                "tel1cli": latin1_safe(sfield(rec, "TEL1CLI")),
                "facturado": truthy(rec, "FACTURADO"),
                "servicios": latin1_safe(servicios_for(planart_idx, idplan)),
                "colfon": safe_num(rec, "COLFON"),
                "collet": safe_num(rec, "COLLET"),
                "modif": str(version)[:20],
                "version": version,
            }
        )

    print(f"Encolar: {len(rows)} citas (omitidas {skipped})")
    if args.dry_run:
        return 0

    for ext in (".dbf", ".cdx", ".fpt"):
        p = cola_path.with_suffix(ext) if ext == ".dbf" else root / f"cola_sincro{ext}"
        if p.exists():
            p.unlink()

    table = dbf.Table(str(cola_path), COLA_SPEC, codepage="cp1252")
    table.open(mode=dbf.READ_WRITE)
    appended = 0
    append_errors = 0
    try:
        for r in rows:
            clean = {}
            for k, v in r.items():
                if isinstance(v, str):
                    clean[k] = latin1_safe(v)
                else:
                    clean[k] = v
            try:
                table.append(clean)
                appended += 1
            except Exception as exc:
                append_errors += 1
                if append_errors <= 3:
                    print(f"AVISO append id={r.get('id')} id_reg={r.get('id_reg')}: {exc}", file=sys.stderr)
    finally:
        table.close()

    log_path = root / "Usuarios" / "_suite_bulk_enqueue.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(
        f"{now.isoformat()} encoladas={appended} omitidas={skipped} errores_append={append_errors}\n",
        encoding="utf-8",
    )
    print(f"OK {cola_path} ({cola_path.stat().st_size} bytes, {appended} filas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
