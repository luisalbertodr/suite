#!/usr/bin/env python3
"""Importa fichas CSV de medicina estetica a historial_clinico.

Por defecto ejecuta un dry-run. Para escribir datos hay que pasar --apply.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict
from datetime import date
from pathlib import Path
from typing import Any

try:
    import psycopg2
    import psycopg2.extras
    from psycopg2 import errors
except Exception as exc:  # pragma: no cover - mensaje operativo
    print(f"No se pudo importar psycopg2: {exc}", file=sys.stderr)
    sys.exit(2)


DEFAULT_CSV = Path(r"C:\Users\OportoW11\Desktop\Medicina Estética\Fichas medicina.csv")
SOURCE_LABEL = "Fichas medicina.csv"
MAIN_SOURCE_PREFIX = "medicina_estetica_csv"
VALID_YEAR_MIN = 2020
VALID_YEAR_MAX = 2027
DATE_RE = re.compile(r"(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?!\d)")
PATIENT_RE = re.compile(r"^\s*Paciente\s+(?:de\s+)?medicina\s+est[eé]tica\s*:\s*(.*)$", re.I)


@dataclass
class ParsedDate:
    raw: str
    ymd: str | None
    valid: bool
    line_index: int
    start: int
    end: int


@dataclass
class ParsedReview:
    fecha: str | None
    raw_fecha: str
    descripcion: str
    line: int
    source_key: str


@dataclass
class ParsedBlock:
    line: int
    end_line: int
    name: str
    normalized_name: str
    source_key: str
    fecha: str | None
    raw_fecha: str | None
    edad: str
    antecedentes: str
    motivo: str
    tratamiento: str
    reviews: list[ParsedReview]
    issues: list[str]


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def repair_text(text: str) -> str:
    if "Ã" in text or "Â" in text:
        try:
            fixed = text.encode("latin-1").decode("utf-8")
            if fixed.count("\ufffd") <= text.count("\ufffd"):
                text = fixed
        except UnicodeError:
            pass
    return "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)


def read_text_guess(path: Path) -> str:
    raw = path.read_bytes()
    candidates: list[str] = []
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        candidates.append(raw.decode(encoding, errors="replace"))
    candidates = [repair_text(text) for text in candidates]
    return min(candidates, key=lambda text: (text.count("\ufffd"), text.count("Ã")))


def normalize_name(value: str) -> str:
    value = repair_text(value)
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^0-9A-Za-zñÑ]+", " ", value).lower().strip()
    return re.sub(r"\s+", " ", value)


def clean_line(value: str) -> str:
    return value.strip().strip(";").strip()


def parse_date_match(match: re.Match[str], line_index: int) -> ParsedDate:
    day = int(match.group(1))
    month = int(match.group(2))
    year_raw = int(match.group(3))
    year = 2000 + year_raw if year_raw < 100 else year_raw
    try:
        parsed = date(year, month, day)
    except ValueError:
        return ParsedDate(match.group(0), None, False, line_index, match.start(), match.end())
    valid = VALID_YEAR_MIN <= parsed.year <= VALID_YEAR_MAX
    return ParsedDate(match.group(0), parsed.isoformat() if valid else None, valid, line_index, match.start(), match.end())


def all_dates(lines: list[str]) -> list[ParsedDate]:
    found: list[ParsedDate] = []
    for idx, line in enumerate(lines):
        for match in DATE_RE.finditer(line):
            found.append(parse_date_match(match, idx))
    return found


def infer_name_from_block(lines: list[str]) -> str:
    for line in lines[:6]:
        if ":" not in line:
            continue
        label, rest = line.split(":", 1)
        if normalize_name(label) != "nombre y fecha":
            continue
        return clean_line(DATE_RE.split(rest, maxsplit=1)[0])
    return ""


def split_blocks(text: str) -> list[tuple[int, int, list[str]]]:
    lines = text.splitlines()
    starts: list[int] = []
    for idx, line in enumerate(lines):
        if PATIENT_RE.match(line):
            starts.append(idx)
    blocks: list[tuple[int, int, list[str]]] = []
    for pos, start in enumerate(starts):
        end = starts[pos + 1] if pos + 1 < len(starts) else len(lines)
        blocks.append((start, end, lines[start:end]))
    return blocks


def parse_initial_fields(lines: list[str]) -> tuple[str, str, str, str]:
    edad_parts: list[str] = []
    antecedentes_parts: list[str] = []
    motivo_parts: list[str] = []
    tratamiento_parts: list[str] = []
    section = "antecedentes"

    for raw in lines:
        line = clean_line(raw)
        if not line:
            continue
        if PATIENT_RE.match(line):
            continue

        lower = normalize_name(line)
        if lower.startswith("nombre y fecha"):
            continue
        if lower.startswith("edad"):
            value = clean_line(line.split(":", 1)[1] if ":" in line else line)
            if value:
                edad_parts.append(value)
            continue
        if lower.startswith("motivo de consulta") or lower.startswith("motivo"):
            section = "motivo"
            value = clean_line(line.split(":", 1)[1] if ":" in line else "")
            if value:
                motivo_parts.append(value)
            continue
        if lower.startswith("tratamiento"):
            section = "tratamiento"
            value = clean_line(line.split(":", 1)[1] if ":" in line else "")
            if value:
                tratamiento_parts.append(value)
            continue

        if section == "motivo":
            motivo_parts.append(line)
        elif section == "tratamiento":
            tratamiento_parts.append(line)
        else:
            antecedentes_parts.append(line)

    if edad_parts:
        antecedentes_parts.insert(0, f"Edad: {' '.join(edad_parts)}")
    return (
        " ".join(edad_parts).strip(),
        "\n".join(antecedentes_parts).strip(),
        "\n".join(motivo_parts).strip(),
        "\n".join(tratamiento_parts).strip(),
    )


def source_key_for(name: str, fecha: str | None, line: int) -> str:
    base = f"{normalize_name(name)}|{fecha or ''}|{line}"
    digest = hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]
    return f"{MAIN_SOURCE_PREFIX}:{digest}"


def parse_block(start: int, end: int, lines: list[str]) -> ParsedBlock:
    match = PATIENT_RE.match(lines[0])
    name = clean_line(match.group(1) if match else "")
    if not name:
        name = infer_name_from_block(lines)

    dates = all_dates(lines)
    issues: list[str] = []
    if not name:
        issues.append("missing_customer_name")
    if not dates:
        issues.append("missing_exam_date")

    for parsed_date in dates:
        if not parsed_date.valid:
            issues.append(f"invalid_date:{parsed_date.raw}")

    first_date = dates[0] if dates else None
    review_dates = dates[1:] if len(dates) > 1 else []
    first_review_line = review_dates[0].line_index if review_dates else len(lines)
    _, antecedentes, motivo, tratamiento = parse_initial_fields(lines[:first_review_line])
    key = source_key_for(name, first_date.ymd if first_date else None, start + 1)

    reviews: list[ParsedReview] = []
    for index, parsed_date in enumerate(review_dates):
        next_line = review_dates[index + 1].line_index if index + 1 < len(review_dates) else len(lines)
        line = lines[parsed_date.line_index]
        description_lines = [clean_line(line[parsed_date.end :])]
        description_lines.extend(clean_line(item) for item in lines[parsed_date.line_index + 1 : next_line])
        description = "\n".join(item for item in description_lines if item).strip()
        if description.endswith(";"):
            description = description[:-1].strip()
        reviews.append(
            ParsedReview(
                fecha=parsed_date.ymd,
                raw_fecha=parsed_date.raw,
                descripcion=description,
                line=start + parsed_date.line_index + 1,
                source_key=f"{key}:rev:{index + 1}",
            )
        )

    return ParsedBlock(
        line=start + 1,
        end_line=end,
        name=name,
        normalized_name=normalize_name(name),
        source_key=key,
        fecha=first_date.ymd if first_date else None,
        raw_fecha=first_date.raw if first_date else None,
        edad="",
        antecedentes=antecedentes,
        motivo=motivo or "Consulta medicina estetica",
        tratamiento=tratamiento,
        reviews=reviews,
        issues=issues,
    )


def parse_csv(path: Path) -> list[ParsedBlock]:
    text = read_text_guess(path)
    return [parse_block(start, end, lines) for start, end, lines in split_blocks(text)]


def apply_date_overrides(blocks: list[ParsedBlock], overrides: dict[str, Any]) -> int:
    """Aplica correcciones de fecha por linea de bloque.

    Formato del JSON: {"<linea>": {"fecha": "YYYY-MM-DD",
                                     "revisiones": [{"fecha": "YYYY-MM-DD", "descripcion": "..."}]}}
    """
    applied = 0
    for block in blocks:
        override = overrides.get(str(block.line))
        if not override:
            continue
        applied += 1
        if override.get("fecha"):
            block.fecha = override["fecha"]
            block.raw_fecha = override["fecha"]
            block.issues = [
                issue
                for issue in block.issues
                if not issue.startswith("invalid_date") and issue != "missing_exam_date"
            ]
            block.source_key = source_key_for(block.name, block.fecha, block.line)
        for index, review in enumerate(override.get("revisiones", [])):
            fecha = review.get("fecha") if isinstance(review, dict) else review
            descripcion = review.get("descripcion", "") if isinstance(review, dict) else ""
            if not fecha:
                continue
            block.reviews.append(
                ParsedReview(
                    fecha=fecha,
                    raw_fecha=fecha,
                    descripcion=descripcion,
                    line=block.line,
                    source_key=f"{block.source_key}:rev:ov{index + 1}",
                )
            )
    return applied


def norm_code(value: Any) -> str:
    """Normaliza un codigo de cliente: sin espacios y sin ceros a la izquierda."""
    text = str(value or "").strip()
    if not text:
        return ""
    return text.lstrip("0") or "0"


def load_customers(
    cur: Any, company_id: str
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
    cur.execute(
        """
        SELECT id::text, company_id::text, name, legacy_codcli
        FROM public.customers
        WHERE company_id = %s
        """,
        (company_id,),
    )
    rows = list(cur.fetchall())
    by_name: dict[str, list[dict[str, Any]]] = {}
    by_code: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_name.setdefault(normalize_name(row["name"] or ""), []).append(row)
        code = norm_code(row.get("legacy_codcli"))
        if code:
            by_code.setdefault(code, []).append(row)
    return by_name, by_code, rows


def load_assignments(path: Path) -> dict[int, str]:
    """Lee un Excel con columnas 'Linea CSV' y 'CODIGO CLIENTE (rellenar)'.

    Devuelve un mapa {linea_csv -> codigo_normalizado}.
    """
    try:
        from openpyxl import load_workbook
    except Exception as exc:  # pragma: no cover
        raise SystemExit(f"Se necesita openpyxl para leer asignaciones: {exc}")

    wb = load_workbook(path, data_only=True)
    ws = wb.active
    headers = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    try:
        line_idx = headers.index("Linea CSV")
    except ValueError:
        raise SystemExit("El Excel de asignaciones no tiene columna 'Linea CSV'.")
    code_idx = next((i for i, h in enumerate(headers) if h.upper().startswith("CODIGO CLIENTE")), None)
    if code_idx is None:
        raise SystemExit("El Excel de asignaciones no tiene columna 'CODIGO CLIENTE'.")

    assignments: dict[int, str] = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if line_idx >= len(row) or code_idx >= len(row):
            continue
        raw_line = row[line_idx]
        raw_code = row[code_idx]
        code = norm_code(raw_code)
        if raw_line is None or not code:
            continue
        try:
            line_no = int(str(raw_line).strip())
        except ValueError:
            continue
        assignments[line_no] = code
    return assignments


def find_customer(
    block: ParsedBlock,
    by_name: dict[str, list[dict[str, Any]]],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]], str | None]:
    exact = by_name.get(block.normalized_name, [])
    if len(exact) == 1:
        return exact[0], [], None
    if len(exact) > 1:
        return None, exact, "ambiguous_customer"
    close_keys = difflib.get_close_matches(block.normalized_name, by_name.keys(), n=5, cutoff=0.82)
    candidates: list[dict[str, Any]] = []
    for key in close_keys:
        candidates.extend(by_name[key][:3])
    return None, candidates, "customer_not_found"


def find_appointment(
    cur: Any,
    company_id: str,
    customer: dict[str, Any],
    fecha: str | None,
) -> tuple[str | None, list[dict[str, Any]], str | None]:
    if not fecha:
        return None, [], "missing_date"
    params = {
        "company_id": company_id,
        "customer_id": customer["id"],
        "legacy_codcli": (customer.get("legacy_codcli") or "").strip(),
        "name": customer["name"],
        "fecha": fecha,
    }
    try:
        cur.execute(
            """
            SELECT id::text, customer_id::text, client_name, legacy_codcli,
                   appointment_date::text AS appointment_date,
                   CASE WHEN left(start_time::text, 10) ~ '^\\d{4}-\\d{2}-\\d{2}$'
                        THEN left(start_time::text, 10)
                        ELSE NULL
                   END AS start_date,
                   start_time::text AS start_time,
                   status
            FROM public.agenda_appointments
            WHERE company_id = %(company_id)s
              AND (
                customer_id = %(customer_id)s
                OR (NULLIF(%(legacy_codcli)s, '') IS NOT NULL AND legacy_codcli = %(legacy_codcli)s)
                OR lower(client_name) = lower(%(name)s)
              )
              AND (
                appointment_date = %(fecha)s::date
                OR left(start_time::text, 10) = %(fecha)s
              )
            ORDER BY start_time NULLS LAST, id
            """,
            params,
        )
    except errors.UndefinedColumn:
        cur.connection.rollback()
        cur.execute(
            """
            SELECT id::text, customer_id::text, client_name, legacy_codcli,
                   NULL::text AS appointment_date,
                   CASE WHEN left(start_time::text, 10) ~ '^\\d{4}-\\d{2}-\\d{2}$'
                        THEN left(start_time::text, 10)
                        ELSE NULL
                   END AS start_date,
                   start_time::text AS start_time,
                   status
            FROM public.agenda_appointments
            WHERE company_id = %(company_id)s
              AND (
                customer_id = %(customer_id)s
                OR (NULLIF(%(legacy_codcli)s, '') IS NOT NULL AND legacy_codcli = %(legacy_codcli)s)
                OR lower(client_name) = lower(%(name)s)
              )
              AND left(start_time::text, 10) = %(fecha)s
            ORDER BY start_time NULLS LAST, id
            """,
            params,
        )
    rows = list(cur.fetchall())
    if len(rows) == 1:
        return rows[0]["id"], rows, None
    if len(rows) > 1:
        return None, rows, "ambiguous_appointment"
    return None, [], "appointment_not_found"


def appointment_already_linked(cur: Any, appointment_id: str, current_history_id: str | None) -> bool:
    cur.execute(
        """
        SELECT id::text
        FROM public.historial_clinico
        WHERE appointment_id = %s
          AND (%s IS NULL OR id <> %s::uuid)
        LIMIT 1
        """,
        (appointment_id, current_history_id, current_history_id),
    )
    if cur.fetchone():
        return True
    try:
        cur.execute(
            """
            SELECT id::text
            FROM public.historial_clinico_revisiones
            WHERE appointment_id = %s
              AND (%s IS NULL OR historial_clinico_id <> %s::uuid)
            LIMIT 1
            """,
            (appointment_id, current_history_id, current_history_id),
        )
        return bool(cur.fetchone())
    except (errors.UndefinedTable, errors.UndefinedColumn):
        cur.connection.rollback()
        return False


def find_existing_history(cur: Any, customer_id: str, source_key: str) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT id::text, appointment_id::text
        FROM public.historial_clinico
        WHERE customer_id = %s
          AND observaciones LIKE %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (customer_id, f"%import_key={source_key}%"),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def upsert_history(
    cur: Any,
    block: ParsedBlock,
    company_id: str,
    customer: dict[str, Any],
    appointment_id: str | None,
) -> str:
    existing = find_existing_history(cur, customer["id"], block.source_key)
    observaciones = f"Importado de {SOURCE_LABEL}; import_key={block.source_key}"
    payload = {
        "customer_id": customer["id"],
        "company_id": company_id,
        "fecha": block.fecha,
        "appointment_id": appointment_id,
        "tipo": "consulta",
        "titulo": (block.motivo or "Consulta medicina estetica")[:200],
        "descripcion": block.antecedentes or None,
        "antecedentes_personales": block.antecedentes or None,
        "motivo_consulta": block.motivo or "Consulta medicina estetica",
        "tratamiento": block.tratamiento or None,
        "proxima_revision_fecha": next((r.fecha for r in block.reviews if r.fecha), None),
        "proxima_revision_descripcion": next((r.descripcion for r in block.reviews if r.fecha), None),
        "observaciones": observaciones,
    }
    if existing:
        cur.execute(
            """
            UPDATE public.historial_clinico
            SET fecha = %(fecha)s,
                appointment_id = %(appointment_id)s,
                tipo = %(tipo)s,
                titulo = %(titulo)s,
                descripcion = %(descripcion)s,
                antecedentes_personales = %(antecedentes_personales)s,
                motivo_consulta = %(motivo_consulta)s,
                tratamiento = %(tratamiento)s,
                proxima_revision_fecha = %(proxima_revision_fecha)s,
                proxima_revision_descripcion = %(proxima_revision_descripcion)s,
                observaciones = %(observaciones)s
            WHERE id = %(id)s::uuid
            """,
            {**payload, "id": existing["id"]},
        )
        return existing["id"]

    cur.execute(
        """
        INSERT INTO public.historial_clinico (
          customer_id, company_id, fecha, appointment_id, tipo, titulo, descripcion,
          antecedentes_personales, motivo_consulta, tratamiento,
          proxima_revision_fecha, proxima_revision_descripcion, observaciones
        )
        VALUES (
          %(customer_id)s, %(company_id)s, %(fecha)s, %(appointment_id)s, %(tipo)s,
          %(titulo)s, %(descripcion)s, %(antecedentes_personales)s, %(motivo_consulta)s,
          %(tratamiento)s, %(proxima_revision_fecha)s, %(proxima_revision_descripcion)s,
          %(observaciones)s
        )
        RETURNING id::text
        """,
        payload,
    )
    return cur.fetchone()["id"]


def upsert_reviews(
    cur: Any,
    block: ParsedBlock,
    company_id: str,
    customer_id: str,
    history_id: str,
    review_appointments: dict[str, str | None],
) -> None:
    active_source_keys = [review.source_key for review in block.reviews if review.fecha]
    cur.execute(
        """
        DELETE FROM public.historial_clinico_revisiones
        WHERE historial_clinico_id = %s
          AND source_key LIKE %s
          AND NOT (source_key = ANY(%s))
        """,
        (history_id, f"{block.source_key}:rev:%", active_source_keys),
    )

    for index, review in enumerate(block.reviews):
        if not review.fecha:
            continue
        payload = {
            "historial_clinico_id": history_id,
            "customer_id": customer_id,
            "company_id": company_id,
            "appointment_id": review_appointments.get(review.source_key),
            "fecha": review.fecha,
            "descripcion": review.descripcion,
            "sort_order": index,
            "source_key": review.source_key,
        }
        cur.execute(
            """
            INSERT INTO public.historial_clinico_revisiones (
              historial_clinico_id, customer_id, company_id, appointment_id,
              fecha, descripcion, sort_order, source_key
            )
            VALUES (
              %(historial_clinico_id)s, %(customer_id)s, %(company_id)s,
              %(appointment_id)s, %(fecha)s, %(descripcion)s, %(sort_order)s,
              %(source_key)s
            )
            ON CONFLICT (historial_clinico_id, source_key)
            WHERE source_key IS NOT NULL
            DO UPDATE SET
              appointment_id = EXCLUDED.appointment_id,
              fecha = EXCLUDED.fecha,
              descripcion = EXCLUDED.descripcion,
              sort_order = EXCLUDED.sort_order
            """,
            payload,
        )


def run_import(args: argparse.Namespace) -> dict[str, Any]:
    blocks = parse_csv(args.csv)

    overrides: dict[str, Any] = {}
    if args.date_overrides:
        overrides = json.loads(args.date_overrides.read_text(encoding="utf-8"))
    overrides_applied = apply_date_overrides(blocks, overrides) if overrides else 0

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    report: dict[str, Any] = {
        "apply": args.apply,
        "csv": str(args.csv),
        "blocks_total": len(blocks),
        "overrides_applied": overrides_applied,
        "planned_records": 0,
        "planned_reviews": 0,
        "written_records": 0,
        "written_reviews": 0,
        "skipped_blocks": [],
        "warnings": [],
    }

    assignments: dict[int, str] = {}
    if args.assignments:
        assignments = load_assignments(args.assignments)
    report["assignments_loaded"] = len(assignments)

    used_appointments: set[str] = set()

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            by_name, by_code, customers = load_customers(cur, args.company_id)
            report["customers_loaded"] = len(customers)

            for block in blocks:
                block_info = {
                    "line": block.line,
                    "name": block.name,
                    "fecha": block.fecha or block.raw_fecha,
                    "source_key": block.source_key,
                }
                if block.issues:
                    block_info["issues"] = block.issues

                assigned_code = assignments.get(block.line)
                if assigned_code:
                    block_info["assigned_code"] = assigned_code
                    code_matches = by_code.get(assigned_code, [])
                    if len(code_matches) == 1:
                        customer, candidates, customer_issue = code_matches[0], [], None
                    elif len(code_matches) == 0:
                        customer, candidates, customer_issue = None, [], "assigned_code_not_found"
                    else:
                        customer, candidates, customer_issue = None, code_matches, "assigned_code_ambiguous"
                else:
                    customer, candidates, customer_issue = find_customer(block, by_name)

                if customer_issue or not customer:
                    report["skipped_blocks"].append(
                        {
                            **block_info,
                            "reason": customer_issue or "customer_not_found",
                            "candidates": [
                                {"id": item["id"], "name": item["name"], "legacy_codcli": item.get("legacy_codcli")}
                                for item in candidates
                            ],
                        }
                    )
                    continue
                if not block.fecha:
                    report["skipped_blocks"].append({**block_info, "reason": "missing_or_invalid_exam_date"})
                    continue

                main_appointment_id, main_appts, main_appt_issue = find_appointment(
                    cur, args.company_id, customer, block.fecha
                )
                existing = find_existing_history(cur, customer["id"], block.source_key)
                if main_appointment_id and (
                    main_appointment_id in used_appointments
                    or appointment_already_linked(cur, main_appointment_id, existing["id"] if existing else None)
                ):
                    report["warnings"].append({**block_info, "reason": "main_appointment_already_linked"})
                    main_appointment_id = None
                elif main_appt_issue:
                    report["warnings"].append(
                        {
                            **block_info,
                            "reason": f"main_{main_appt_issue}",
                            "appointments": [dict(item) for item in main_appts],
                        }
                    )
                if main_appointment_id:
                    used_appointments.add(main_appointment_id)

                review_appointments: dict[str, str | None] = {}
                valid_reviews = 0
                for review in block.reviews:
                    if not review.fecha:
                        report["warnings"].append(
                            {
                                **block_info,
                                "reason": "review_invalid_date",
                                "review_line": review.line,
                                "review_date": review.raw_fecha,
                            }
                        )
                        continue
                    valid_reviews += 1
                    review_appointment_id, review_appts, review_appt_issue = find_appointment(
                        cur, args.company_id, customer, review.fecha
                    )
                    if review_appointment_id and (
                        review_appointment_id in used_appointments
                        or appointment_already_linked(
                            cur, review_appointment_id, existing["id"] if existing else None
                        )
                    ):
                        report["warnings"].append(
                            {
                                **block_info,
                                "reason": "review_appointment_already_linked",
                                "review_line": review.line,
                                "review_date": review.fecha,
                            }
                        )
                        review_appointment_id = None
                    elif review_appt_issue:
                        report["warnings"].append(
                            {
                                **block_info,
                                "reason": f"review_{review_appt_issue}",
                                "review_line": review.line,
                                "review_date": review.fecha,
                                "appointments": [dict(item) for item in review_appts],
                            }
                        )
                    if review_appointment_id:
                        used_appointments.add(review_appointment_id)
                    review_appointments[review.source_key] = review_appointment_id

                report["planned_records"] += 1
                report["planned_reviews"] += valid_reviews
                if args.apply:
                    history_id = upsert_history(cur, block, args.company_id, customer, main_appointment_id)
                    upsert_reviews(cur, block, args.company_id, customer["id"], history_id, review_appointments)
                    report["written_records"] += 1
                    report["written_reviews"] += valid_reviews

            if args.apply:
                conn.commit()
            else:
                conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return report


def main() -> int:
    load_dotenv(Path(".env"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--company-id", default=os.environ.get("PROMOTE_COMPANY_ID") or os.environ.get("LEGACY_COMPANY_ID"))
    parser.add_argument("--database-url", default=os.environ.get("SUPABASE_DB_URL"))
    parser.add_argument("--report", type=Path, default=Path("tmp/medical_aesthetic_import_report.json"))
    parser.add_argument(
        "--assignments",
        type=Path,
        default=None,
        help="Excel con asignaciones manuales (Linea CSV -> codigo de cliente).",
    )
    parser.add_argument(
        "--date-overrides",
        type=Path,
        default=None,
        help="JSON con correcciones de fecha por linea de bloque.",
    )
    parser.add_argument("--apply", action="store_true", help="Escribe datos. Sin este flag solo hace dry-run.")
    args = parser.parse_args()

    if not args.csv.exists():
        print(f"No existe el CSV: {args.csv}", file=sys.stderr)
        return 2
    if args.assignments and not args.assignments.exists():
        print(f"No existe el Excel de asignaciones: {args.assignments}", file=sys.stderr)
        return 2
    if args.date_overrides and not args.date_overrides.exists():
        print(f"No existe el JSON de overrides: {args.date_overrides}", file=sys.stderr)
        return 2
    if not args.company_id:
        print("Falta --company-id o LEGACY_COMPANY_ID/PROMOTE_COMPANY_ID en .env", file=sys.stderr)
        return 2
    if not args.database_url:
        print("Falta --database-url o SUPABASE_DB_URL en .env", file=sys.stderr)
        return 2

    report = run_import(args)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(
        "dry-run" if not args.apply else "apply",
        f"bloques={report['blocks_total']}",
        f"overrides={report.get('overrides_applied', 0)}",
        f"asignaciones={report.get('assignments_loaded', 0)}",
        f"registros={report['planned_records']}",
        f"revisiones={report['planned_reviews']}",
        f"saltados={len(report['skipped_blocks'])}",
        f"avisos={len(report['warnings'])}",
        f"reporte={args.report}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
