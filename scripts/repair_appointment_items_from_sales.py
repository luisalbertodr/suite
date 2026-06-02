"""
Repara appointment_items genéricos («Servicio») usando ventas, facturas Suite y líneas legacy.faclin.

Prioridad de fuentes:
  1) sale_items / invoice_items (código en descripción o article_id)
  2) JSON en sales.notes (items[].name)
  3) legacy.faclin por cliente+fecha, desambiguado por importe del ticket

Uso:
  python scripts/repair_appointment_items_from_sales.py --dry-run
  python scripts/repair_appointment_items_from_sales.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from legacy_company import get_company_id
from legacy_cobro import cli_lookup_keys, is_faccab_serie_a, norm_cli_key, parse_decimal, truthy_legacy
from legacy_planinc_items import (
    item_templates_signature,
    parse_codart_lines_from_planart_text,
    parse_codart_lines_from_sale_notes,
    pseudo_planart_from_codart_lines,
    templates_need_repair,
)
from promote_legacy_planinc_to_agenda import build_item_templates_for_group, _safe_float
from repair_appointment_items_from_planinc import (
    load_catalog,
    preload_items_by_apt,
    replace_items,
)

LINE_CODE_RE = re.compile(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*(.+)$", re.IGNORECASE)
GENERIC_LABELS = {"servicio", "cita importada", "artículo", ""}


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


def norm_date(value) -> str | None:
    s = str(value or "").strip()
    if not s:
        return None
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return None


def parse_line_codart(description: str) -> tuple[str, str] | None:
    d = str(description or "").strip()
    if not d or d.lower() in GENERIC_LABELS:
        return None
    parsed = parse_codart_lines_from_planart_text(d)
    if parsed:
        cod, des = parsed[0]
        return cod, des
    m = LINE_CODE_RE.match(d)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None


def parse_sale_notes_items(notes: str | None) -> list[dict]:
    if not notes:
        return []
    try:
        data = json.loads(notes)
        items = data.get("items") if isinstance(data, dict) else None
        return list(items) if isinstance(items, list) else []
    except json.JSONDecodeError:
        return []


def money(value) -> float:
    return float(parse_decimal(value))


def is_generic_items(items: list[dict]) -> bool:
    if not items:
        return False
    return all(
        str(it.get("label") or "").strip().lower() in GENERIC_LABELS and not it.get("article_id")
        for it in items
    )


def codart_lines_from_sources(
    sale_ctx: dict | None,
    faclin_line: dict | None,
    article_codigo_by_id: dict[str, str],
) -> list[tuple[str, str, float]]:
    """(codart, descripción, importe opcional para desambiguar)."""
    found: list[tuple[str, str, float]] = []

    def add(cod: str, des: str, amt: float = 0.0) -> None:
        cod = str(cod or "").strip()
        if not cod or cod.lower() in GENERIC_LABELS:
            return
        key = cod.upper()
        if any(f[0].upper() == key for f in found):
            return
        found.append((cod, des or cod, amt))

    if sale_ctx:
        for row in sale_ctx.get("sale_items") or []:
            aid = str(row.get("article_id") or "").strip()
            if aid and aid in article_codigo_by_id:
                cod = article_codigo_by_id[aid]
                des = str(row.get("description") or cod)
                add(cod, des, money(row.get("total_price")))
                continue
            parsed = parse_line_codart(str(row.get("description") or ""))
            if parsed:
                add(parsed[0], parsed[1], money(row.get("total_price")))

        for row in sale_ctx.get("invoice_items") or []:
            parsed = parse_line_codart(str(row.get("description") or ""))
            if parsed:
                add(parsed[0], parsed[1], money(row.get("total_price")))

        for it in parse_sale_notes_items(sale_ctx.get("notes")):
            name = str(it.get("name") or "").strip()
            parsed = parse_line_codart(name)
            if parsed:
                add(parsed[0], parsed[1], money(it.get("total") or it.get("price")))

        for cod, des in parse_codart_lines_from_sale_notes(sale_ctx.get("notes")):
            add(cod, des, money(sale_ctx.get("total_amount")))

    if faclin_line:
        cod = str(faclin_line.get("codart") or "").strip()
        des = str(faclin_line.get("desart") or "").strip() or cod
        add(cod, des, money(faclin_line.get("subtot")))

    return found


def dedupe_faclin_lines(lines: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    out: list[dict] = []
    for ln in lines:
        key = (
            str(ln.get("numfac") or ""),
            str(ln.get("codart") or "").strip(),
            str(ln.get("desart") or "").strip().upper(),
            money(ln.get("subtot")),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(ln)
    return out


def pick_faclin_line(lines: list[dict], target_amount: float) -> dict | None:
    with_cod = dedupe_faclin_lines([ln for ln in lines if str(ln.get("codart") or "").strip()])
    if not with_cod:
        return None

    def same_codart(group: list[dict]) -> bool:
        codes = {str(ln.get("codart") or "").strip().lstrip("0") or "0" for ln in group}
        return len(codes) == 1

    if target_amount > 0:
        matched = [ln for ln in with_cod if abs(money(ln.get("subtot")) - target_amount) <= 0.02]
        if len(matched) == 1:
            return matched[0]
        if len(matched) > 1:
            if same_codart(matched):
                return matched[0]
            non_svc = [
                ln
                for ln in matched
                if str(ln.get("desart") or "").strip().lower() not in GENERIC_LABELS
            ]
            if len(non_svc) == 1:
                return non_svc[0]
            if same_codart(non_svc):
                return non_svc[0]

    if len(with_cod) == 1:
        return with_cod[0]
    if same_codart(with_cod):
        return with_cod[0]
    return None


def templates_from_codart_lines(
    lines: list[tuple[str, str, float]],
    planart_by_idplan: dict,
    art_des: dict,
    article_by_legacy: dict,
    art_legacy_meta: dict,
    pseudo_idplan: str,
) -> list[dict]:
    if not lines:
        return []
    pseudo_rows = pseudo_planart_from_codart_lines([(c, d) for c, d, _ in lines])
    fake = dict(planart_by_idplan)
    fake[pseudo_idplan] = list(pseudo_rows)
    seg = {"start_time": "09:00", "end_time": "10:00", "idplan": pseudo_idplan}
    templates = build_item_templates_for_group(
        [seg],
        fake,
        art_des,
        article_by_legacy,
        art_legacy_meta,
    )
    for i, (_, _, amt) in enumerate(lines):
        if amt > 0 and i < len(templates):
            templates[i]["unit_price"] = amt
    return templates


def preload_sales_by_appointment(cur) -> dict[str, dict]:
    by_apt: dict[str, dict] = {}
    cur.execute(
        """
        SELECT appointment_id::text AS appointment_id, id::text AS sale_id,
               total_amount, notes, invoice_id::text AS invoice_id, created_at
        FROM public.sales
        WHERE appointment_id IS NOT NULL AND status = 'completed'
        ORDER BY appointment_id, created_at DESC
        """
    )
    sale_ids: list[str] = []
    for row in cur.fetchall():
        aid = str(row["appointment_id"])
        if aid in by_apt:
            continue
        ctx = dict(row)
        ctx["sale_items"] = []
        ctx["invoice_items"] = []
        by_apt[aid] = ctx
        sale_ids.append(str(row["sale_id"]))

    if sale_ids:
        cur.execute(
            """
            SELECT sale_id::text, description, total_price, article_id::text
            FROM public.sale_items WHERE sale_id = ANY(%s::uuid[])
            """,
            (sale_ids,),
        )
        items_by_sale: dict[str, list] = defaultdict(list)
        for row in cur.fetchall():
            items_by_sale[str(row["sale_id"])].append(dict(row))

        inv_ids = list({str(c["invoice_id"]) for c in by_apt.values() if c.get("invoice_id")})
        inv_by_id: dict[str, list] = defaultdict(list)
        if inv_ids:
            cur.execute(
                """
                SELECT invoice_id::text, description, total_price
                FROM public.invoice_items WHERE invoice_id = ANY(%s::uuid[])
                """,
                (inv_ids,),
            )
            for row in cur.fetchall():
                inv_by_id[str(row["invoice_id"])].append(dict(row))

        for ctx in by_apt.values():
            sid = str(ctx["sale_id"])
            ctx["sale_items"] = items_by_sale.get(sid, [])
            iid = ctx.get("invoice_id")
            if iid:
                ctx["invoice_items"] = inv_by_id.get(str(iid), [])

    return by_apt


def preload_faclin_index(cur) -> dict[tuple[str, str], list[dict]]:
    cur.execute("SELECT to_regclass('legacy.faclin') AS t, to_regclass('legacy.faccab') AS c")
    reg = cur.fetchone()
    if not reg or not reg["t"] or not reg["c"]:
        return {}

    cur.execute(
        """
        SELECT fc.codcli::text AS codcli, fc.fecfac::date AS fecfac, fc.serfac, fc.anulada,
               fl.codart::text AS codart, fl.desart, fl.subtot, fc.numfac
        FROM legacy.faccab fc
        JOIN legacy.faclin fl
          ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
        WHERE NULLIF(btrim(fc.codcli::text), '') IS NOT NULL
          AND NULLIF(btrim(fl.codart::text), '') IS NOT NULL
        """
    )
    index: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in cur.fetchall():
        if truthy_legacy(row.get("anulada")):
            continue
        if not is_faccab_serie_a(row):
            continue
        d = norm_date(row.get("fecfac"))
        if not d:
            continue
        codcli = str(row.get("codcli") or "").strip()
        slot = {
            "codart": str(row.get("codart") or "").strip(),
            "desart": str(row.get("desart") or "").strip(),
            "subtot": row.get("subtot"),
            "numfac": row.get("numfac"),
        }
        for key in cli_lookup_keys(codcli):
            index[(key, d)].append(slot)
    return index


def preload_customer_codcli(cur) -> dict[str, str]:
    cur.execute(
        """
        SELECT id::text, NULLIF(btrim(legacy_codcli::text), '') AS legacy_codcli
        FROM public.customers
        WHERE legacy_codcli IS NOT NULL
        """
    )
    return {str(r["id"]): str(r["legacy_codcli"]) for r in cur.fetchall() if r.get("legacy_codcli")}


def preload_article_codigos(cur, company_id: str) -> dict[str, str]:
    cur.execute(
        """
        SELECT id::text, codigo, legacy_codart
        FROM public.articles WHERE company_id = %s
        """,
        (company_id,),
    )
    out: dict[str, str] = {}
    for row in cur.fetchall():
        aid = str(row["id"])
        for raw in (row.get("codigo"), row.get("legacy_codart")):
            c = str(raw or "").strip()
            if c:
                out[aid] = c
                break
    return out


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--company-id", default="")
    ap.add_argument("--limit", type=int, default=0, help="Máximo de citas a reparar (0 = todas)")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    company_id = (args.company_id or "").strip() or get_company_id("PROMOTE_COMPANY_ID", "LEGACY_COMPANY_ID")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("Cargando catálogo…")
    planart_by_idplan, art_des, article_by_legacy, art_legacy_meta = load_catalog(cur, company_id)
    print("Cargando ventas y facturas…")
    sales_by_apt = preload_sales_by_appointment(cur)
    article_codigo_by_id = preload_article_codigos(cur, company_id)
    print("Cargando legacy.faclin…")
    faclin_index = preload_faclin_index(cur)
    customer_codcli = preload_customer_codcli(cur)
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
        SELECT id::text, appointment_date::text, customer_id::text, client_name, legacy_idplan
        FROM public.agenda_appointments
        WHERE company_id = %s
        """,
        (company_id,),
    )
    appointments = cur.fetchall()
    print(f"Citas empresa: {len(appointments)}")

    repaired = 0
    skipped = 0
    unchanged = 0
    no_source = 0
    batch_updates: list[tuple[str, list[dict]]] = []

    for apt in appointments:
        apt_id = str(apt["id"])
        current = items_by_apt.get(apt_id, [])
        if not is_generic_items(current):
            unchanged += 1
            continue

        sale_ctx = sales_by_apt.get(apt_id)
        target_amount = money(sale_ctx.get("total_amount")) if sale_ctx else 0.0

        faclin_line = None
        cust_id = str(apt.get("customer_id") or "")
        codcli = customer_codcli.get(cust_id, "")
        apt_date = norm_date(apt.get("appointment_date"))
        if codcli and apt_date:
            lines: list[dict] = []
            for key in cli_lookup_keys(codcli):
                lines.extend(faclin_index.get((key, apt_date), []))
            lines = dedupe_faclin_lines(lines)
            if lines:
                faclin_line = pick_faclin_line(lines, target_amount)

        cod_lines = codart_lines_from_sources(sale_ctx, faclin_line, article_codigo_by_id)
        if not cod_lines and faclin_line:
            cod_lines = codart_lines_from_sources(None, faclin_line, article_codigo_by_id)

        if not cod_lines:
            no_source += 1
            continue

        pseudo_id = f"sale-{apt_id[:8]}"
        templates = templates_from_codart_lines(
            cod_lines,
            planart_by_idplan,
            art_des,
            article_by_legacy,
            art_legacy_meta,
            pseudo_id,
        )
        if not templates or not any(t.get("article_id") for t in templates):
            no_source += 1
            continue

        if not templates_need_repair(current, templates):
            if item_templates_signature(current) == item_templates_signature(templates):
                unchanged += 1
            else:
                skipped += 1
            continue

        if args.limit > 0 and repaired >= args.limit:
            break

        repaired += 1
        if repaired <= 25:
            src = "faclin" if faclin_line and not sale_ctx else "sale/inv"
            if faclin_line and sale_ctx:
                src = "sale+faclin"
            print(
                f"  repair [{src}] {apt_id[:8]}… {(apt.get('client_name') or '')[:24]} "
                f"-> {str(templates[0].get('label', ''))[:48]}"
            )
        batch_updates.append((apt_id, templates))

    if repaired > 25:
        print(f"  … y {repaired - 25} más")

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
