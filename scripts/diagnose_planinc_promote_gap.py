#!/usr/bin/env python3
"""Compara legacy.planinc vs agenda_appointments para un día y empleado Dunasoft."""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from legacy_company import get_company_id
from promote_legacy_planinc_to_agenda import (
    effective_planinc_date,
    effective_planinc_time,
    exclude_tipinc_set,
    norm_cli_key,
    norm_idplan,
    planinc_row_sort_key,
)

ENV_PATH = ROOT / ".env"


def load_dotenv() -> None:
    if not ENV_PATH.is_file():
        return
    for line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default="2026-06-11")
    ap.add_argument("--employee-name", default="Betha")
    ap.add_argument("--company-id", default="")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        print("Falta SUPABASE_DB_URL", file=sys.stderr)
        return 2

    company_id = (args.company_id or "").strip() or get_company_id()
    target_date = args.date.strip()
    name_q = args.employee_name.strip().lower()

    conn = psycopg2.connect(url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT id, name, dunasoft_codemp, company_id, is_active
        FROM public.agenda_employees
        WHERE company_id = %s AND lower(trim(name)) LIKE %s
        """,
        (company_id, f"%{name_q}%"),
    )
    emps = cur.fetchall()
    print(f"Empleados '{args.employee_name}' en company {company_id}:")
    for e in emps:
        print(f"  {e['name']} id={e['id']} dunasoft_codemp={e.get('dunasoft_codemp')!r} is_active={e.get('is_active')}")

    cur.execute(
        """
        SELECT id, name, dunasoft_codemp FROM public.agenda_employees
        WHERE company_id = %s AND lower(trim(name)) = 'sin asignar' LIMIT 1
        """,
        (company_id,),
    )
    sin_asignar = cur.fetchone()
    sin_id = str(sin_asignar["id"]) if sin_asignar else None

    employee_map: dict[str, str] = {}
    cur.execute(
        "SELECT id, name, dunasoft_codemp FROM public.agenda_employees WHERE company_id = %s",
        (company_id,),
    )
    for row in cur.fetchall():
        code = str(row.get("dunasoft_codemp") or "").strip()
        if code:
            employee_map[code.lstrip("0") or "0"] = str(row["id"])
            employee_map[code] = str(row["id"])

    cur.execute("SELECT * FROM legacy.planinc")
    rows = cur.fetchall()

    exclude_tip = exclude_tipinc_set()
    winners_by_idplan: dict[str, tuple] = {}
    by_planinc_only: dict[str, dict] = {}

    for r in rows:
        date = effective_planinc_date(r)
        if date != target_date:
            continue
        codemp_raw = str(r.get("codemp") or "").strip()
        codemp_norm = codemp_raw.lstrip("0") or "0"
        emp_id = employee_map.get(codemp_norm) or employee_map.get(codemp_raw) or sin_id

        start_time = effective_planinc_time(r, "horini")
        end_time = effective_planinc_time(r, "horfin", start_time)
        idplan_s = norm_idplan(r.get("idplan"))
        tipinc_s = str(r.get("tipinc") or "").strip()
        sk = planinc_row_sort_key(r)
        planinc_id = r.get("idplaninc")
        legacy_planinc_id = int(planinc_id) if str(planinc_id or "").strip().isdigit() else None

        seg = {
            "codemp_raw": codemp_raw,
            "employee_id": emp_id,
            "idplan": idplan_s,
            "legacy_planinc_id": legacy_planinc_id,
            "tipinc": tipinc_s,
            "client": str(r.get("nomcli") or r.get("codcli") or "").strip(),
            "horini": start_time,
            "horfin": end_time,
        }

        if idplan_s:
            wk = f"idplan:{idplan_s}"
            prev = winners_by_idplan.get(wk)
            if prev is None or sk > prev[0]:
                winners_by_idplan[wk] = (sk, seg, r)
        else:
            key = f"planinc:{legacy_planinc_id}"
            if key not in by_planinc_only:
                by_planinc_only[key] = (seg, r)

    promoted: list[tuple] = []
    dropped_borrar: list[tuple] = []
    betha_codemps: set[str] = set()
    for e in emps:
        c = str(e.get("dunasoft_codemp") or "").strip()
        if c:
            betha_codemps.add(c)
            betha_codemps.add(c.lstrip("0") or "0")

    for _wk, (sk, seg, raw) in winners_by_idplan.items():
        tip_u = str(seg.get("tipinc") or "").strip().upper()
        if exclude_tip and tip_u in exclude_tip:
            dropped_borrar.append((seg, raw, "idplan_winner_borrar"))
            continue
        promoted.append((seg, raw, "idplan"))

    for key, (seg, raw) in by_planinc_only.items():
        promoted.append((seg, raw, "solo_idplaninc"))

    # Filas legacy ese día con codemp de Betha
    legacy_betha_rows = []
    for r in rows:
        if effective_planinc_date(r) != target_date:
            continue
        cod = str(r.get("codemp") or "").strip()
        if cod in betha_codemps or (cod.lstrip("0") or "0") in betha_codemps:
            legacy_betha_rows.append(r)

    print(f"\n=== {target_date} — Dunasoft planinc (codemp Betha) ===")
    print(f"Filas legacy.planinc: {len(legacy_betha_rows)}")
    for r in legacy_betha_rows:
        print(
            f"  idplaninc={r.get('idplaninc')} idplan={r.get('idplan')!r} codemp={r.get('codemp')!r} "
            f"tipinc={r.get('tipinc')!r} hor={effective_planinc_time(r,'horini')}-{effective_planinc_time(r,'horfin')} "
            f"cli={str(r.get('nomcli') or r.get('codcli') or '')[:40]}"
        )

    print(f"\n=== Promoción simulada (reglas promote_legacy_planinc_to_agenda) ===")
    print(f"Ganadores idplan ese día (todos codemp): {len(winners_by_idplan)}")
    print(f"Excluidos TIPINC {exclude_tip}: {len(dropped_borrar)}")

    betha_promoted = [p for p in promoted if p[0]["codemp_raw"] in betha_codemps or (p[0]["codemp_raw"].lstrip("0") or "0") in betha_codemps]
    betha_dropped = [p for p in dropped_borrar if p[0]["codemp_raw"] in betha_codemps or (p[0]["codemp_raw"].lstrip("0") or "0") in betha_codemps]

    print(f"Citas promovidas con codemp Betha: {len(betha_promoted)}")
    for seg, raw, reason in betha_promoted:
        mapped_name = "?"
        for e in emps:
            if str(e.get("dunasoft_codemp") or "").strip() in (seg["codemp_raw"], seg["codemp_raw"].lstrip("0") or "0"):
                mapped_name = e["name"]
                break
        if seg["employee_id"] == sin_id:
            mapped_name = "→ Sin asignar (sin mapeo codemp)"
        print(
            f"  [{reason}] idplan={seg['idplan']!r} planinc={seg['legacy_planinc_id']} "
            f"tipinc={seg['tipinc']!r} → emp={mapped_name} {seg['horini']}-{seg['horfin']} {seg['client'][:30]}"
        )

    print(f"Descartadas BORRAR (última versión idplan) codemp Betha: {len(betha_dropped)}")
    for seg, raw, reason in betha_dropped:
        print(f"  idplan={seg['idplan']!r} planinc={seg['legacy_planinc_id']} tipinc={seg['tipinc']!r}")

    # Suite DB
    emp_ids = [str(e["id"]) for e in emps]
    if emp_ids:
        cur.execute(
            """
            SELECT id, legacy_planinc_id, legacy_idplan, client_name, start_time, end_time, employee_id
            FROM public.agenda_appointments
            WHERE company_id = %s AND employee_id = ANY(%s::uuid[])
              AND (appointment_date = %s OR start_time::text LIKE %s)
            ORDER BY start_time
            """,
            (company_id, emp_ids, target_date, f"{target_date}%"),
        )
        suite_rows = cur.fetchall()
    else:
        suite_rows = []

    print(f"\n=== Suite agenda_appointments (employee Betha) ===")
    print(f"Citas en BD: {len(suite_rows)}")
    for a in suite_rows:
        print(
            f"  legacy_planinc={a.get('legacy_planinc_id')} idplan={a.get('legacy_idplan')!r} "
            f"{a.get('client_name')!r} {a.get('start_time')}–{a.get('end_time')}"
        )

    # Citas del día en Sin asignar que vienen de codemp Betha en legacy
    if sin_id:
        cur.execute(
            """
            SELECT a.id, a.legacy_planinc_id, a.legacy_idplan, a.legacy_codemp, a.client_name, a.start_time
            FROM public.agenda_appointments a
            WHERE company_id = %s AND employee_id = %s
              AND (appointment_date = %s OR start_time::text LIKE %s)
            """,
            (company_id, sin_id, target_date, f"{target_date}%"),
        )
        sin_rows = cur.fetchall()
        sin_from_betha = [a for a in sin_rows if str(a.get("legacy_codemp") or "").strip() in betha_codemps]
        if sin_rows:
            print(f"\nCitas en 'Sin asignar' ese día: {len(sin_rows)} (legacy_codemp Betha: {len(sin_from_betha)})")
            for a in sin_from_betha[:15]:
                print(f"  legacy_codemp={a.get('legacy_codemp')!r} planinc={a.get('legacy_planinc_id')} {a.get('client_name')!r}")

    # idplan en legacy Betha sin cita en suite
    promoted_idplans = {str(p[0]["idplan"]) for p in betha_promoted if p[0]["idplan"]}
    suite_idplans = {str(a.get("legacy_idplan") or "").strip() for a in suite_rows if a.get("legacy_idplan")}
    suite_planincs = {int(a["legacy_planinc_id"]) for a in suite_rows if a.get("legacy_planinc_id") is not None}

    missing_idplan = promoted_idplans - suite_idplans
    if missing_idplan:
        print(f"\nIDPLAN promovidos (simulación) sin match legacy_idplan en Suite: {sorted(missing_idplan)}")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
