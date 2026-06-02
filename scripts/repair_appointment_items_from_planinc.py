"""
Repara appointment_items de citas existentes usando legacy.planart + texto PLANART en planinc.

No borra citas ni ventas; solo sustituye ítems cuando la nueva plantilla mejora el enlace
(artículo/precio) respecto al genérico «Servicio».

Uso:
  python scripts/repair_appointment_items_from_planinc.py --dry-run
  python scripts/repair_appointment_items_from_planinc.py
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from legacy_company import get_company_id
from legacy_planinc_items import (
    item_templates_signature,
    parse_codart_lines_from_sale_notes,
    pseudo_planart_from_codart_lines,
    templates_need_repair,
)
from promote_legacy_planinc_to_agenda import (
    build_item_templates_for_group,
    _safe_float,
)


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def norm_time(value, default="09:00") -> str:
    t = str(value or "").strip()
    if not t:
        return default
    if len(t) >= 8 and t[2] == ":":
        return t[11:16] if "T" in t or "-" in t[:10] else t[:5]
    if len(t) == 4 and t.isdigit():
        return f"{t[:2]}:{t[2:]}"
    if len(t) >= 5 and t[2] == ":":
        return t[:5]
    return default


def norm_date(value) -> str | None:
    s = str(value or "").strip()
    if not s:
        return None
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return None


def load_catalog(cur, company_id: str):
    planart_by_idplan: dict[str, list[dict]] = defaultdict(list)
    cur.execute("SELECT idplan, codart, hora, artcom FROM legacy.planart")
    for pr in cur.fetchall():
        idp = str(pr.get("idplan") or "").strip()
        if idp:
            planart_by_idplan[idp].append(dict(pr))

    art_des: dict[str, str] = {}
    art_legacy_meta: dict[str, dict] = {}
    cur.execute("SELECT codart, desart, pvpa, tiempo, tipart FROM legacy.articulos")
    for ar in cur.fetchall():
        c = str(ar.get("codart") or "").strip()
        if not c:
            continue
        art_des[c] = str(ar.get("desart") or "").strip() or c
        art_des[c.lstrip("0") or "0"] = art_des[c]
        art_legacy_meta[c] = {
            "desart": art_des[c],
            "pvpa": _safe_float(ar.get("pvpa")),
            "tiempo": ar.get("tiempo"),
            "tipart": ar.get("tipart"),
        }
        art_legacy_meta[c.lstrip("0") or "0"] = art_legacy_meta[c]

    article_by_legacy: dict[str, dict] = {}
    cur.execute(
        """
        SELECT id, legacy_codart, codigo, precio, duration_minutes, article_kind, descripcion
        FROM public.articles
        WHERE company_id = %s
        """,
        (company_id,),
    )
    for ar in cur.fetchall():
        row = dict(ar)
        for raw in (ar.get("legacy_codart"), ar.get("codigo")):
            c = str(raw or "").strip()
            if not c:
                continue
            article_by_legacy[c] = row
            article_by_legacy[c.lstrip("0") or "0"] = row

    return planart_by_idplan, art_des, article_by_legacy, art_legacy_meta


def preload_planinc(cur) -> tuple[dict[str, dict], dict[tuple[str, str], dict]]:
    by_planinc: dict[str, dict] = {}
    by_idplan_date: dict[tuple[str, str], dict] = {}
    cur.execute(
        """
        SELECT idplaninc::text AS idplaninc, idplan, fecha::text AS fecha,
               horini, horfin, planart, planartx, texto
        FROM legacy.planinc
        """
    )
    for row in cur.fetchall():
        r = dict(row)
        by_planinc[str(r["idplaninc"])] = r
        idp = str(r.get("idplan") or "").strip()
        fecha = norm_date(r.get("fecha"))
        if idp and fecha:
            key = (idp, fecha)
            prev = by_idplan_date.get(key)
            if prev is None or int(r["idplaninc"]) > int(prev["idplaninc"]):
                by_idplan_date[key] = r
    return by_planinc, by_idplan_date


def preload_sales_notes(cur, company_id: str) -> dict[str, str]:
    notes_by_apt: dict[str, str] = {}
    cur.execute(
        """
        SELECT appointment_id::text, notes
        FROM (
          SELECT appointment_id, notes,
                 ROW_NUMBER() OVER (PARTITION BY appointment_id ORDER BY created_at DESC) AS rn
          FROM public.sales
          WHERE company_id = %s
            AND appointment_id IS NOT NULL
            AND status = 'completed'
            AND notes IS NOT NULL
        ) s
        WHERE rn = 1
        """,
        (company_id,),
    )
    for row in cur.fetchall():
        aid = str(row["appointment_id"])
        if aid:
            notes_by_apt[aid] = str(row["notes"] or "")
    return notes_by_apt


def preload_items_by_apt(cur) -> dict[str, list[dict]]:
    by_apt: dict[str, list[dict]] = defaultdict(list)
    cur.execute(
        """
        SELECT appointment_id::text AS appointment_id, kind, label, duration_minutes,
               occupies_time, sort_order, notes, article_id::text, unit_price, quantity
        FROM public.appointment_items
        ORDER BY appointment_id, sort_order
        """
    )
    for row in cur.fetchall():
        by_apt[str(row["appointment_id"])].append(dict(row))
    return by_apt


def planinc_for_appointment(
    apt: dict,
    by_planinc: dict[str, dict],
    by_idplan_date: dict[tuple[str, str], dict],
) -> dict | None:
    lid = apt.get("legacy_planinc_id")
    if lid is not None and str(lid) in by_planinc:
        return by_planinc[str(lid)]
    idplan = str(apt.get("legacy_idplan") or "").strip()
    date = norm_date(apt.get("appointment_date"))
    if idplan and date:
        return by_idplan_date.get((idplan, date))
    return None


def segment_from_appointment(apt: dict, planinc: dict | None) -> dict:
    start = norm_time(apt.get("start_time") or (planinc.get("horini") if planinc else None))
    end = norm_time(apt.get("end_time") or (planinc.get("horfin") if planinc else None), start)
    planart_raw = ""
    texto = ""
    idplan = ""
    legacy_planinc_id = apt.get("legacy_planinc_id")
    if planinc:
        planart_raw = str(planinc.get("planartx") or planinc.get("planart") or "").strip()
        texto = str(planinc.get("texto") or "").strip()
        idplan = str(planinc.get("idplan") or "").strip()
        if planinc.get("idplaninc") is not None:
            legacy_planinc_id = int(planinc["idplaninc"])
    else:
        idplan = str(apt.get("legacy_idplan") or "").strip()

    return {
        "start_time": start,
        "end_time": end,
        "planart_txt": planart_raw,
        "planart_raw": planart_raw,
        "texto": texto,
        "idplan": idplan,
        "legacy_planinc_id": legacy_planinc_id,
    }


def templates_from_sale_notes(
    notes: str,
    seg: dict,
    appointment_id: str,
    planart_by_idplan: dict,
    art_des: dict,
    article_by_legacy: dict,
    art_legacy_meta: dict,
) -> list[dict]:
    lines = parse_codart_lines_from_sale_notes(notes)
    if not lines:
        return []
    idp = str(seg.get("idplan") or "").strip() or f"sale-{appointment_id[:8]}"
    pseudo = pseudo_planart_from_codart_lines(lines)
    fake_planart = dict(planart_by_idplan)
    fake_planart[idp] = list(pseudo)
    return build_item_templates_for_group(
        [{**seg, "idplan": idp}],
        fake_planart,
        art_des,
        article_by_legacy,
        art_legacy_meta,
    )


def replace_items(cur, appointment_id: str, templates: list[dict], item_cols: list[str]) -> None:
    cur.execute("DELETE FROM public.appointment_items WHERE appointment_id = %s", (appointment_id,))
    if not templates:
        return
    rows: list[list] = []
    for t in templates:
        row = {"appointment_id": appointment_id}
        for c in item_cols:
            if c == "appointment_id":
                continue
            row[c] = t.get(c)
        rows.append([row[c] for c in item_cols])
    icl = ", ".join(item_cols)
    itpl = "(" + ", ".join(["%s"] * len(item_cols)) + ")"
    execute_values(
        cur,
        f"INSERT INTO public.appointment_items ({icl}) VALUES %s",
        rows,
        template=itpl,
        page_size=200,
    )


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--company-id", default="")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    company_id = (args.company_id or "").strip() or get_company_id("PROMOTE_COMPANY_ID", "LEGACY_COMPANY_ID")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("Cargando catálogo legacy…")
    planart_by_idplan, art_des, article_by_legacy, art_legacy_meta = load_catalog(cur, company_id)
    print("Cargando planinc…")
    by_planinc, by_idplan_date = preload_planinc(cur)
    print("Cargando ventas y ítems actuales…")
    sales_notes = preload_sales_notes(cur, company_id)
    items_by_apt = preload_items_by_apt(cur)

    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'appointment_items'
        """
    )
    item_cols = [
        c["column_name"]
        for c in cur.fetchall()
        if c["column_name"]
        in (
            "appointment_id",
            "kind",
            "label",
            "duration_minutes",
            "occupies_time",
            "sort_order",
            "notes",
            "article_id",
            "unit_price",
            "quantity",
        )
    ]

    cur.execute(
        """
        SELECT id::text, appointment_date::text, start_time::text, end_time::text,
               legacy_planinc_id, legacy_idplan, client_name
        FROM public.agenda_appointments
        WHERE company_id = %s
        """,
        (company_id,),
    )
    appointments = cur.fetchall()
    print(f"Citas a revisar: {len(appointments)}")

    repaired = 0
    skipped = 0
    unchanged = 0
    no_source = 0
    batch_updates: list[tuple[str, list[dict]]] = []

    for apt in appointments:
        apt_id = str(apt["id"])
        planinc = planinc_for_appointment(apt, by_planinc, by_idplan_date)
        seg = segment_from_appointment(apt, planinc)
        templates = build_item_templates_for_group(
            [seg],
            planart_by_idplan,
            art_des,
            article_by_legacy,
            art_legacy_meta,
        )
        if not templates or not any(t.get("article_id") for t in templates):
            notes = sales_notes.get(apt_id)
            if notes:
                templates = templates_from_sale_notes(
                    notes,
                    seg,
                    apt_id,
                    planart_by_idplan,
                    art_des,
                    article_by_legacy,
                    art_legacy_meta,
                )

        if not templates:
            no_source += 1
            continue

        current = items_by_apt.get(apt_id, [])
        if not templates_need_repair(current, templates):
            if item_templates_signature(current) == item_templates_signature(templates):
                unchanged += 1
            else:
                skipped += 1
            continue

        repaired += 1
        if repaired <= 30:
            print(
                f"  repair {apt_id[:8]}… {(apt.get('client_name') or '')[:28]} "
                f"-> {str(templates[0].get('label', ''))[:50]}"
            )
        batch_updates.append((apt_id, templates))

    if repaired > 30:
        print(f"  … y {repaired - 30} más")

    if not args.dry_run:
        for apt_id, templates in batch_updates:
            replace_items(cur, apt_id, templates, item_cols)
        conn.commit()
        print("Cambios aplicados.")
    else:
        conn.rollback()
        print("--dry-run: sin cambios")

    print(
        f"Resumen: reparadas={repaired} sin_cambio={unchanged} "
        f"omitidas={skipped} sin_fuente={no_source}"
    )
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
