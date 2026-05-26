"""
Promueve filas de legacy.planinc a public.agenda_appointments.

- Tramos consecutivos del mismo IDPLAN (mismo día, cliente y empleado Dunasoft) se fusionan
  en una sola cita. No se fusionan citas con IDPLAN distinto aunque sean consecutivas.
- PLANINC guarda historial: varias filas comparten IDPLAN (código de seguimiento). Para la agenda
  solo se usa la última versión (mayor FECHORINC / idplaninc como desempate). El resto queda en
  legacy.planinc para auditoría.
- PROMOTE_EXCLUDE_TIPINC: valores de TIPINC que indican borrado (coma-separados; se comparan en mayúsculas).
  Por defecto se usa BORRAR (Dunasoft Style). Si defines la variable vacía, no se excluye ningún TIPINC.

Variables (.env o entorno):
  SUPABASE_DB_URL
  PROMOTE_COMPANY_ID   (default UUID en código)
  PROMOTE_CLEAR        legacy_only | all   (sin --clean-import)
  PROMOTE_STATUS       ej. confirmed
  PROMOTE_MERGE_CONSECUTIVE  1|0   (default 1: fusionar tramos consecutivos)
  PROMOTE_MERGE_GAP_MINUTES  minutos máximos entre fin de un tramo e inicio del siguiente
                              para seguir considerándolos consecutivos (default 15; p. ej. hueco de un slot)
  PROMOTE_EXCLUDE_TIPINC   coma-separados; por defecto BORRAR. Vacío = no excluir por TIPINC

Reimportación el día del corte a producción (Style Dunasoft → Suite):
  1) Exportar DBF desde Style al directorio habitual (por defecto LEGACY_DBF_DIR=E:\\dbf).
  2) Volcar legacy en Postgres: LEGACY_IMPORT_SCOPE=all python scripts/legacy_dbf_import_wave1.py
  3) Sustituir citas en la app: python scripts/promote_legacy_planinc_to_agenda.py --clean-import

Uso:
  python scripts/promote_legacy_planinc_to_agenda.py
  python scripts/promote_legacy_planinc_to_agenda.py --dry-run
  python scripts/promote_legacy_planinc_to_agenda.py --clean-import
  python scripts/promote_legacy_planinc_to_agenda.py --no-merge
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from collections import OrderedDict, defaultdict
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"

DEFAULT_COMPANY = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"


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


def norm_date(value) -> str | None:
    v = str(value or "").strip()
    if len(v) == 8 and v.isdigit():
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}"
    if len(v) >= 10 and v[4] == "-":
        return v[:10]
    return None


def norm_time(value, default: str = "09:00") -> str:
    t = str(value or "").strip()
    if not t:
        return default
    if len(t) == 4 and t.isdigit():
        t = f"{t[:2]}:{t[2:]}"
    if len(t) >= 5 and t[2] == ":":
        return t[:5]
    return default


def time_to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":", 1)
    return int(h) * 60 + int(m)


def segment_duration_minutes(start_hhmm: str, end_hhmm: str) -> int:
    a = time_to_minutes(start_hhmm)
    b = time_to_minutes(end_hhmm)
    if b < a:
        return 0
    return b - a


def ts_for_column(data_type: str, date_s: str, hhmm: str) -> str:
    if data_type == "timestamp with time zone" or data_type == "timestamp without time zone":
        return f"{date_s}T{hhmm}:00"
    return hhmm


def norm_cli_key(codcli: str) -> str:
    c = str(codcli or "").strip()
    return c.lstrip("0") or "0"


def norm_idplan(value) -> str:
    return str(value or "").strip()


def effective_planinc_date(r: dict) -> str | None:
    """Dunasoft Style guarda la versión vigente en campos *x cuando existen."""
    return norm_date(r.get("fechax")) or norm_date(r.get("fecha"))


def effective_planinc_time(r: dict, field: str, default: str = "09:00") -> str:
    xval = str(r.get(f"{field}x") or "").strip()
    base = str(r.get(field) or "").strip()
    return norm_time(xval or base, default)


def effective_planinc_text(r: dict, field: str) -> str:
    xval = str(r.get(f"{field}x") or "").strip()
    base = str(r.get(field) or "").strip()
    return xval or base


def is_synthetic_planart_description(text: str) -> bool:
    """Detecta resúmenes tipo '[10:45] 6666 - Lumbar[11:15] 6668 - Dorsal'."""
    t = str(text or "").strip()
    if not t:
        return False
    return bool(re.search(r"\[\d{1,2}:\d{2}\]\s*\S+", t))


def appointment_description_from_seg(seg: dict) -> str:
    for key in ("texto", "planart_txt"):
        value = str(seg.get(key) or "").strip()
        if value and not is_synthetic_planart_description(value):
            return value[:1000]
    return ""


def encode_pricing_notes(unit_price: float, quantity: float = 1) -> str:
    payload = {
        "quantity": quantity,
        "unit_price": unit_price,
        "bonus_payment_mode": "none",
    }
    return f"__pricing__{json.dumps(payload, separators=(',', ':'))}"


def _safe_float(value) -> float:
    raw = str(value or "").strip().replace(",", ".")
    if not raw:
        return 0.0
    try:
        return float(raw)
    except ValueError:
        return 0.0


def parse_legacy_minutes(value) -> int:
    raw = str(value or "").strip()
    if not raw:
        return 0
    if raw.isdigit():
        n = int(raw)
        return n if 0 < n <= 480 else 0
    if len(raw) == 4 and raw.isdigit():
        return 0
    if len(raw) >= 5 and raw[2] == ":":
        return 0
    return 0


def infer_item_kind(article_kind: str | None, tipart: str | None) -> str:
    kind = str(article_kind or "").strip().lower()
    if kind in ("servicio", "service"):
        return "service"
    if kind in ("producto", "product"):
        return "product"
    tip = str(tipart or "").strip().upper()
    if tip in ("S", "SERV", "SERVICIO"):
        return "service"
    return "product"


def planinc_row_sort_key(r: dict) -> tuple[int, int]:
    """
    Ordenar versiones de la misma cita (IDPLAN): FECHORINC si se puede interpretar,
    si no FECHA; desempate idplaninc ascendente (suele crecer con el tiempo).
    """
    fch = str(r.get("fechorinc") or "").strip()
    digits = "".join(ch for ch in fch if ch.isdigit())
    ts = 0
    if len(digits) >= 14:
        ts = int(digits[:14])
    elif len(digits) >= 8:
        ts = int(digits[:8]) * 10**6
    else:
        da = norm_date(r.get("fecha"))
        if da and len(da) >= 10 and da[:4].isdigit():
            ts = int(da.replace("-", "")[:8]) * 10**6
    inc = 0
    if str(r.get("idplaninc") or "").strip().isdigit():
        inc = int(str(r.get("idplaninc")).strip())
    return (ts, inc)


def exclude_tipinc_set() -> set[str]:
    """Dunasoft Style suele usar TIPINC='BORRAR' en el historial; se puede ampliar vía .env."""
    if "PROMOTE_EXCLUDE_TIPINC" in os.environ:
        raw = os.environ.get("PROMOTE_EXCLUDE_TIPINC", "").strip()
        if not raw:
            return set()
        return {x.strip().upper() for x in raw.split(",") if x.strip()}
    return {"BORRAR"}


def table_column_types(cur, table: str) -> dict[str, str]:
    cur.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return {str(r["column_name"]): str(r["data_type"]) for r in cur.fetchall()}


def public_table_exists(cur, table: str) -> bool:
    cur.execute(
        """
        SELECT 1 AS x
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return cur.fetchone() is not None


def merge_consecutive_segments(
    segments: list[dict],
    gap_max_minutes: int,
) -> list[list[dict]]:
    if not segments:
        return []
    out: list[list[dict]] = []
    group = [segments[0]]
    for s in segments[1:]:
        prev = group[-1]
        prev_idplan = str(prev.get("idplan") or "").strip()
        curr_idplan = str(s.get("idplan") or "").strip()
        if prev_idplan and curr_idplan:
            same_idplan = prev_idplan == curr_idplan
        elif prev_idplan or curr_idplan:
            same_idplan = False
        else:
            same_idplan = True
        same_session = (
            prev["date"] == s["date"]
            and prev["cli_key"] == s["cli_key"]
            and prev["codemp_raw"] == s["codemp_raw"]
            and prev["employee_id"] == s["employee_id"]
            and same_idplan
        )
        gap = s["start_min"] - prev["end_min"]
        if same_session and 0 <= gap <= gap_max_minutes:
            group.append(s)
        else:
            out.append(group)
            group = [s]
    out.append(group)
    return out


def canonical_legacy_planinc_id(group: list[dict]) -> int | None:
    for s in group:
        lid = s.get("legacy_planinc_id")
        if lid is not None:
            return int(lid)
    return None


def collect_planart_rows_for_group(
    group: list[dict],
    planart_by_idplan: dict[str, list[dict]],
) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    rows: list[dict] = []
    for seg in group:
        idp = str(seg.get("idplan") or "").strip()
        if not idp:
            continue
        for pa in planart_by_idplan.get(idp, []):
            cod = str(pa.get("codart") or "").strip()
            key = (idp, cod)
            if not cod or key in seen:
                continue
            seen.add(key)
            rows.append(pa)
    return rows


def build_item_templates_for_group(
    group: list[dict],
    planart_by_idplan: dict[str, list[dict]],
    art_des: dict[str, str],
    article_by_legacy: dict[str, dict],
    art_legacy_meta: dict[str, dict],
) -> list[dict]:
    planart_rows = collect_planart_rows_for_group(group, planart_by_idplan)
    if planart_rows:
        rows: list[dict] = []
        for order, pa in enumerate(planart_rows):
            cod = str(pa.get("codart") or "").strip()
            cod_norm = cod.lstrip("0") or "0"
            pub = article_by_legacy.get(cod) or article_by_legacy.get(cod_norm) or {}
            legacy = art_legacy_meta.get(cod) or art_legacy_meta.get(cod_norm) or {}
            des = (
                str(pub.get("descripcion") or "").strip()
                or str(legacy.get("desart") or "").strip()
                or art_des.get(cod)
                or art_des.get(cod_norm)
                or cod
                or "Artículo"
            )
            label = f"{cod} - {des}" if cod else des
            price = float(pub.get("precio") or legacy.get("pvpa") or 0)
            duration = int(pub.get("duration_minutes") or parse_legacy_minutes(legacy.get("tiempo")) or 0)
            if duration <= 0:
                duration = 30
            kind = infer_item_kind(pub.get("article_kind"), legacy.get("tipart"))
            occupies = kind == "service"
            note = encode_pricing_notes(price) if price > 0 else None
            rows.append(
                {
                    "kind": kind,
                    "label": label[:500],
                    "duration_minutes": duration,
                    "occupies_time": occupies,
                    "sort_order": order,
                    "notes": note,
                    "article_id": pub.get("id"),
                    "unit_price": price,
                    "quantity": 1,
                }
            )
        return rows

    rows = []
    for order, seg in enumerate(group):
        dur = segment_duration_minutes(seg["start_time"], seg["end_time"])
        if dur <= 0:
            dur = 30
        label = (seg["planart_txt"] or seg["texto"] or "Servicio").strip() or "Servicio"
        note = None
        if seg.get("legacy_planinc_id") is not None:
            note = f"legacy_planinc_id={seg['legacy_planinc_id']}"
        rows.append(
            {
                "kind": "service",
                "label": label[:500],
                "duration_minutes": dur,
                "occupies_time": True,
                "sort_order": order,
                "notes": note,
                "article_id": None,
                "unit_price": 0,
                "quantity": 1,
            }
        )
    return rows


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Solo contar filas, no escribir")
    ap.add_argument(
        "--clean-import",
        action="store_true",
        help="Borra todas las citas de la empresa y reimporta desde legacy.planinc (ignora PROMOTE_CLEAR).",
    )
    ap.add_argument(
        "--no-merge",
        action="store_true",
        help="Desactiva la fusión de tramos consecutivos (una cita por id planinc).",
    )
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise SystemExit("Falta SUPABASE_DB_URL")
    company_id = os.environ.get("PROMOTE_COMPANY_ID", DEFAULT_COMPANY).strip()
    clear_mode = "all" if args.clean_import else os.environ.get("PROMOTE_CLEAR", "legacy_only").strip().lower()
    if args.clean_import and not args.dry_run:
        print(
            "Importación limpia: se eliminarán todas las filas de public.agenda_appointments "
            f"con company_id={company_id} y se insertarán de nuevo desde legacy.planinc."
        )
    status_default = os.environ.get("PROMOTE_STATUS", "confirmed").strip()

    merge_on = not args.no_merge and os.environ.get("PROMOTE_MERGE_CONSECUTIVE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )
    gap_max = int(os.environ.get("PROMOTE_MERGE_GAP_MINUTES", "15").strip() or "15")
    if gap_max < 0:
        gap_max = 0

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    types = table_column_types(cur, "agenda_appointments")
    if not types:
        raise SystemExit("No se encontró public.agenda_appointments")

    item_types: dict[str, str] = {}
    if public_table_exists(cur, "appointment_items"):
        item_types = table_column_types(cur, "appointment_items")
        if "id" not in types:
            print("Aviso: no se insertarán appointment_items (hace falta columna id en agenda_appointments).")
            item_types = {}

    emp_types = table_column_types(cur, "agenda_employees")
    emp_sel = "SELECT id, name"
    if "dunasoft_codemp" in emp_types:
        emp_sel += ", dunasoft_codemp"
    emp_sel += " FROM public.agenda_employees WHERE company_id = %s"
    cur.execute(emp_sel, (company_id,))
    emp_rows = cur.fetchall()
    employee_map: dict[str, str] = {}
    fallback_employee_id: str | None = None
    for row in emp_rows:
        code = str(row.get("dunasoft_codemp") or "").strip() if "dunasoft_codemp" in row else ""
        if code:
            employee_map[code.lstrip("0") or "0"] = str(row["id"])
            employee_map[code] = str(row["id"])
        if str(row.get("name") or "").strip().lower() == "sin asignar":
            fallback_employee_id = str(row["id"])

    if not fallback_employee_id:
        cur.execute(
            """
            SELECT id FROM public.agenda_employees
            WHERE company_id = %s AND lower(trim(name)) = 'sin asignar'
            LIMIT 1
            """,
            (company_id,),
        )
        r = cur.fetchone()
        if r:
            fallback_employee_id = str(r["id"])

    if not fallback_employee_id:
        raise SystemExit("No hay empleado 'Sin asignar' ni mapeo dunasoft_codemp; crea uno antes de promover.")

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
        if c:
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
    if public_table_exists(cur, "articles"):
        cur.execute(
            """
            SELECT id, legacy_codart, precio, duration_minutes, article_kind, codigo, descripcion
            FROM public.articles
            WHERE company_id = %s AND COALESCE(legacy_codart, '') <> ''
            """,
            (company_id,),
        )
        for ar in cur.fetchall():
            c = str(ar.get("legacy_codart") or "").strip()
            if not c:
                continue
            row = dict(ar)
            article_by_legacy[c] = row
            article_by_legacy[c.lstrip("0") or "0"] = row

    cur.execute("SELECT * FROM legacy.planinc")
    source_rows = cur.fetchall()

    # idplan -> mejor fila (última modificación por FECHORINC / idplaninc)
    winners_by_idplan: dict[str, tuple[tuple[int, int], dict]] = {}
    # sin idplan: una fila por idplaninc (comportamiento anterior)
    by_planinc_only: "OrderedDict[str, dict]" = OrderedDict()

    for r in source_rows:
        date = effective_planinc_date(r)
        if not date:
            continue

        start_time = effective_planinc_time(r, "horini")
        end_time = effective_planinc_time(r, "horfin", start_time)
        codemp_raw = str(r.get("codemp") or "").strip()
        codemp_norm = codemp_raw.lstrip("0") or "0"
        employee_id = employee_map.get(codemp_norm) or employee_map.get(codemp_raw) or fallback_employee_id

        nomcli = str(r.get("nomcli") or "").strip()
        codcli = str(r.get("codcli") or "").strip()
        client_name = nomcli or codcli or "Cliente"

        planart_txt = effective_planinc_text(r, "planart")
        texto = effective_planinc_text(r, "texto")
        description = appointment_description_from_seg({"texto": texto, "planart_txt": planart_txt}) or "Cita importada"

        planinc_id = r.get("idplaninc")
        legacy_planinc_id = int(planinc_id) if str(planinc_id or "").strip().isdigit() else None

        try:
            sm = time_to_minutes(start_time)
            em = time_to_minutes(end_time)
        except ValueError:
            continue
        if em < sm:
            continue

        idplan_s = norm_idplan(r.get("idplan"))
        tipinc_s = str(r.get("tipinc") or "").strip()
        sk = planinc_row_sort_key(r)

        seg = {
            "date": date,
            "start_time": start_time,
            "end_time": end_time,
            "start_min": sm,
            "end_min": em,
            "codemp_raw": codemp_raw,
            "employee_id": employee_id,
            "codcli": codcli,
            "cli_key": norm_cli_key(codcli),
            "client_name": client_name,
            "description": description[:1000],
            "planart_txt": planart_txt,
            "texto": texto,
            "idplan": idplan_s,
            "legacy_planinc_id": legacy_planinc_id,
            "tipinc": tipinc_s,
        }

        if idplan_s:
            wk = f"idplan:{idplan_s}"
            prev = winners_by_idplan.get(wk)
            if prev is None or sk > prev[0]:
                winners_by_idplan[wk] = (sk, seg)
            continue

        if legacy_planinc_id is not None and "legacy_planinc_id" in types:
            dedupe_key = f"planinc:{legacy_planinc_id}"
        else:
            dedupe_key = "|".join(
                [
                    str(legacy_planinc_id or ""),
                    date,
                    start_time,
                    codemp_raw,
                    codcli,
                    client_name,
                    description,
                ]
            )
        if dedupe_key in by_planinc_only:
            continue
        by_planinc_only[dedupe_key] = seg

    exclude_tip = exclude_tipinc_set()
    dropped_deleted = 0
    segments: list[dict] = []
    for _wk, (_sk, seg) in winners_by_idplan.items():
        tip_u = str(seg.get("tipinc") or "").strip().upper()
        if exclude_tip and tip_u in exclude_tip:
            dropped_deleted += 1
            continue
        seg.pop("tipinc", None)
        segments.append(seg)
    for seg in by_planinc_only.values():
        seg.pop("tipinc", None)
        segments.append(seg)
    segments.sort(
        key=lambda s: (
            s["date"],
            s["start_min"],
            s["legacy_planinc_id"] if s["legacy_planinc_id"] is not None else 0,
        )
    )

    if merge_on:
        groups = merge_consecutive_segments(segments, gap_max)
    else:
        groups = [[s] for s in segments]

    st_type = types.get("start_time", "text")
    et_type = types.get("end_time", "text")

    payload: list[dict] = []
    items_for_appointments: list[tuple[str, list[dict]]] = []

    fused = sum(1 for g in groups if len(g) > 1)
    total_item_templates = 0

    for group in groups:
        first = group[0]
        last = group[-1]
        canon_id = canonical_legacy_planinc_id(group)
        ids_in_group = [s["legacy_planinc_id"] for s in group if s["legacy_planinc_id"] is not None]

        desc = appointment_description_from_seg(first) or first["description"]
        if len(group) > 1:
            tail = ", ".join(str(i) for i in ids_in_group[:12])
            if len(ids_in_group) > 12:
                tail += ", …"
            extra = f" [fusionados {len(group)} tramos Dunasoft: {tail}]"
            desc = (desc + extra)[:1000]

        appt_id = str(uuid.uuid4())
        row_out: dict = {
            "company_id": company_id,
            "employee_id": first["employee_id"],
            "description": desc,
            "color": "bg-blue-100 border-blue-300",
        }
        if "id" in types:
            row_out["id"] = appt_id

        if "title" in types:
            row_out["title"] = first["client_name"][:200]
        if "client_name" in types:
            row_out["client_name"] = first["client_name"][:120]
        if "appointment_date" in types:
            row_out["appointment_date"] = first["date"]
        if "start_time" in types:
            row_out["start_time"] = ts_for_column(st_type, first["date"], first["start_time"])
        if "end_time" in types:
            row_out["end_time"] = ts_for_column(et_type, last["date"], last["end_time"])
        if "status" in types:
            row_out["status"] = status_default
        if "legacy_planinc_id" in types:
            row_out["legacy_planinc_id"] = canon_id
        if "legacy_idplan" in types:
            idp = str(first.get("idplan") or "").strip()
            row_out["legacy_idplan"] = idp[:120] if idp else None
        if "legacy_codemp" in types:
            row_out["legacy_codemp"] = first["codemp_raw"]
        if "legacy_codcli" in types:
            row_out["legacy_codcli"] = first["codcli"]

        item_templates = build_item_templates_for_group(
            group,
            planart_by_idplan,
            art_des,
            article_by_legacy,
            art_legacy_meta,
        )
        total_item_templates += len(item_templates)

        payload.append(row_out)
        items_for_appointments.append((appt_id, item_templates))

    print("legacy.planinc filas leídas:", len(source_rows))
    print("tramos (última versión por IDPLAN / FECHORINC + filas sin IDPLAN):", len(segments))
    if exclude_tip:
        print("omitidas última versión = borrado (TIPINC en PROMOTE_EXCLUDE_TIPINC):", dropped_deleted)
    print("fusionado consecutivos:", "sí" if merge_on else "no", f"(hueco máx. {gap_max} min)")
    print("grupos con >1 tramo:", fused)
    print("citas a crear:", len(payload))
    if item_types:
        print("ítems (aprox., plantillas):", total_item_templates)

    if args.dry_run:
        conn.rollback()
        cur.close()
        conn.close()
        print("--dry-run: no se ha modificado la base.")
        return

    if clear_mode == "all":
        cur.execute(
            "SELECT count(*)::bigint AS n FROM public.agenda_appointments WHERE company_id = %s",
            (company_id,),
        )
        n_del = cur.fetchone()["n"]
        cur.execute("DELETE FROM public.agenda_appointments WHERE company_id = %s", (company_id,))
        label = "PROMOTE_CLEAR=all" if not args.clean_import else "--clean-import"
        print(f"Eliminadas {n_del} citas de la empresa ({label}).")
    elif "legacy_planinc_id" in types or "legacy_idplan" in types:
        parts: list[str] = []
        if "legacy_planinc_id" in types:
            parts.append("legacy_planinc_id IS NOT NULL")
        if "legacy_idplan" in types:
            parts.append("(legacy_idplan IS NOT NULL AND legacy_idplan <> '')")
        if parts:
            cur.execute(
                f"DELETE FROM public.agenda_appointments WHERE company_id = %s AND ({' OR '.join(parts)})",
                (company_id,),
            )
            print("Eliminadas citas importadas legacy (PROMOTE_CLEAR=legacy_only).")
    else:
        print(
            "Aviso: agenda_appointments no tiene legacy_planinc_id; no se borró nada. "
            "Usa PROMOTE_CLEAR=all o añade la columna antes de promover."
        )

    if not payload:
        conn.commit()
        print("Nada que insertar.")
        cur.close()
        conn.close()
        return

    insert_cols = [c for c in payload[0].keys()]
    col_list = ", ".join(insert_cols)
    template = "(" + ", ".join(["%s"] * len(insert_cols)) + ")"
    values = [[row[c] for c in insert_cols] for row in payload]

    cur2 = conn.cursor()
    batch = 500
    inserted = 0
    try:
        for i in range(0, len(values), batch):
            chunk = values[i : i + batch]
            execute_values(
                cur2,
                f"INSERT INTO public.agenda_appointments ({col_list}) VALUES %s",
                chunk,
                template=template,
                page_size=batch,
            )
            inserted += len(chunk)
            if inserted % 10000 == 0:
                print("insertadas", inserted, "citas")

        item_inserted = 0
        if item_types and items_for_appointments:
            item_cols = [
                c
                for c in (
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
                if c in item_types
            ]
            if item_cols:
                flat_items: list[list[object]] = []
                for appt_id, tmpl in items_for_appointments:
                    for t in tmpl:
                        row: dict = {"appointment_id": appt_id}
                        for k in item_cols:
                            if k == "appointment_id":
                                continue
                            row[k] = t.get(k)
                        flat_items.append([row[c] for c in item_cols])

                icl = ", ".join(item_cols)
                itpl = "(" + ", ".join(["%s"] * len(item_cols)) + ")"
                ivals = flat_items
                cur3 = conn.cursor()
                ib = 500
                for j in range(0, len(ivals), ib):
                    execute_values(
                        cur3,
                        f"INSERT INTO public.appointment_items ({icl}) VALUES %s",
                        ivals[j : j + ib],
                        template=itpl,
                        page_size=ib,
                    )
                    item_inserted += len(ivals[j : j + ib])
                cur3.close()
                print("Insertados", item_inserted, "ítems de cita.")

        conn.commit()
        print("Listo. Insertadas", inserted, "citas.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur2.close()
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
