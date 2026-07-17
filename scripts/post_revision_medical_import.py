#!/usr/bin/env python3
"""Post-proceso revision import medicina estetica.

1) Merge clientes nuevos segun codigos del CSV revisado
2) Limpia textos duplicados (AP/motivo/cabecera metidos en tratamiento)
3) Importa fichas saltadas con fechas indicadas
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from legacy_company import DEFAULT_COMPANY_ID
from merge_duplicate_customers import fk_tables, reassign_and_delete, load_customer_by_id, SELECT_COLUMNS

COMPANY_ID = DEFAULT_COMPANY_ID
SOURCE_LABEL = "Fichas medicina.csv"
MAIN_SOURCE_PREFIX = "medicina_estetica_csv_v2"

# loser_codcli -> winner_codcli (+ optional rename)
MERGES = [
    {"loser": "10000071", "winner": "008142", "rename": "Maria Cambon Bellón"},
    {"loser": "10000068", "winner": "000330", "rename": "María del Mar Lamas Pernas"},
    {"loser": "10000072", "winner": "008044", "rename": None},  # Paqui Fernández
]

# Keep as-is: 10000069, 10000070

ANTELO_CODES = ("004674", "008088")
LAYLA_CODE = "007331"


def _require_psycopg2():
    import psycopg2
    import psycopg2.extras

    return psycopg2, psycopg2.extras


def norm_code(value: str | None) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text.lstrip("0") or "0"


def pad_code(value: str) -> str:
    n = norm_code(value)
    if not n.isdigit():
        return value
    return n.zfill(6)


def find_by_code(cur: Any, code: str) -> dict[str, Any] | None:
    variants = {code, norm_code(code), pad_code(code), code.zfill(6), code.zfill(8)}
    cur.execute(
        f"""
        SELECT {", ".join(SELECT_COLUMNS)}
        FROM public.customers
        WHERE company_id = %s
          AND ltrim(coalesce(legacy_codcli,''), '0') = %s
        ORDER BY created_at NULLS LAST
        """,
        (COMPANY_ID, norm_code(code)),
    )
    rows = [dict(r) for r in cur.fetchall()]
    if not rows:
        # exact match fallback
        cur.execute(
            f"""
            SELECT {", ".join(SELECT_COLUMNS)}
            FROM public.customers
            WHERE company_id = %s AND legacy_codcli = ANY(%s)
            """,
            (COMPANY_ID, list(variants)),
        )
        rows = [dict(r) for r in cur.fetchall()]
    if not rows:
        return None
    if len(rows) == 1:
        return rows[0]
    # prefer padded classic codes over 10000xxx
    rows.sort(key=lambda r: (str(r.get("legacy_codcli") or "").startswith("10000"), str(r.get("legacy_codcli") or "")))
    return rows[0]


def completeness_score(cur: Any, customer: dict[str, Any]) -> int:
    cid = customer["id"]
    cur.execute(
        """
        SELECT
          (SELECT count(*) FROM public.historial_clinico WHERE customer_id = %s) AS h,
          (SELECT count(*) FROM public.agenda_appointments WHERE customer_id = %s) AS a
        """,
        (cid, cid),
    )
    row = cur.fetchone()
    score = int(row["h"] or 0) * 10 + int(row["a"] or 0) * 5
    for field in ("phone", "email", "tax_id", "birth_date", "address_street"):
        if customer.get(field):
            score += 2
    if customer.get("name"):
        score += len(str(customer["name"]))
    return score


def merge_pair(cur: Any, fks: list, loser: dict, winner: dict, rename: str | None, apply: bool) -> dict:
    info = {
        "loser_id": loser["id"],
        "loser_code": loser.get("legacy_codcli"),
        "loser_name": loser.get("name"),
        "winner_id": winner["id"],
        "winner_code": winner.get("legacy_codcli"),
        "winner_name": winner.get("name"),
        "rename": rename,
    }
    if not apply:
        return {**info, "dry_run": True}
    result = reassign_and_delete(cur, fks, winner["id"], loser, include_phones=True)
    if rename and rename.strip() and rename.strip() != (winner.get("name") or "").strip():
        cur.execute(
            "UPDATE public.customers SET name = %s WHERE id = %s",
            (rename.strip(), winner["id"]),
        )
        info["renamed"] = rename.strip()
    info["moved"] = result.get("moved")
    info["field_updates"] = result.get("field_updates")
    return info


SECTION_SPLIT_RE = re.compile(
    r"(?is)\b(?:nombre\s+y\s+fecha|edad|ap|antecedentes(?:\s+personales)?|motivo(?:\s+de\s+consulta)?|tratamiento|me)\s*:"
)


def extract_labeled(text: str, label: str) -> str | None:
    """Extrae valor de una etiqueta hasta la siguiente etiqueta conocida."""
    pattern = re.compile(
        rf"(?is)\b(?:{label})\s*:\s*(.*?)(?=\b(?:nombre\s+y\s+fecha|edad|ap|antecedentes(?:\s+personales)?|motivo(?:\s+de\s+consulta)?|tratamiento|me)\s*:|$)"
    )
    m = pattern.search(text or "")
    if not m:
        return None
    value = m.group(1)
    if value is None:
        return None
    return value.strip().strip(";").strip() or None


def looks_polluted(text: str | None) -> bool:
    if not text:
        return False
    lower = text.lower()
    hits = sum(
        1
        for token in ("nombre y fecha:", "edad:", "ap:", "motivo de consulta:", "tratamiento:")
        if token in lower
    )
    return hits >= 2


def clean_record_fields(antecedentes: str | None, motivo: str | None, tratamiento: str | None) -> tuple[str | None, str | None, str | None]:
    ant = (antecedentes or "").strip()
    mot = (motivo or "").strip()
    tto = (tratamiento or "").strip()

    source = tto if looks_polluted(tto) else (mot if looks_polluted(mot) else "")
    if not source:
        # Quitar cabeceras sueltas si el tto empieza por Nombre y fecha sin ser tan polucionado
        if tto.lower().startswith("nombre y fecha"):
            only_tto = extract_labeled(tto, "tratamiento")
            if only_tto:
                tto = only_tto
        return ant or None, mot or None, tto or None

    ap = extract_labeled(source, r"ap|antecedentes(?:\s+personales)?")
    me = extract_labeled(source, r"me")
    edad = extract_labeled(source, r"edad")
    motivo_ex = extract_labeled(source, r"motivo(?:\s+de\s+consulta)?")
    tto_ex = extract_labeled(source, r"tratamiento")

    # AP: preferir el ya guardado; si vacio, reconstruir
    if not ant:
        parts = []
        if edad:
            parts.append(f"Edad: {edad}")
        if ap:
            parts.append(ap)
        if me:
            parts.append(me if me.lower().startswith("me") else f"ME: {me}")
        ant = "\n".join(parts).strip()

    if motivo_ex and (not mot or mot.lower() in {"consulta medicina estética", "consulta medicina estetica", "revisión", "revision"} or looks_polluted(mot)):
        mot = motivo_ex

    if tto_ex:
        tto = tto_ex
    elif looks_polluted(tto):
        # Si no hay etiqueta tratamiento, quitar bloques AP/motivo del texto
        cleaned = tto
        for lab in ("nombre y fecha", "edad", "ap", "antecedentes", "motivo de consulta", "motivo", "me"):
            cleaned = re.sub(
                rf"(?is)\b{lab}\s*:.*?(?=\b(?:nombre\s+y\s+fecha|edad|ap|antecedentes|motivo(?:\s+de\s+consulta)?|tratamiento|me)\s*:|$)",
                "",
                cleaned,
            )
        tto = cleaned.strip(" \n;-")

    # Evitar que AP se repita tal cual dentro de tratamiento
    if ant and tto and ant.strip() and ant.strip() in tto:
        tto = tto.replace(ant.strip(), "").strip(" \n;-")

    return ant or None, mot or None, tto or None


def repair_polluted_historiales(cur: Any, apply: bool) -> dict[str, Any]:
    cur.execute(
        """
        SELECT id::text, customer_id::text, fecha::text,
               antecedentes_personales, motivo_consulta, tratamiento, descripcion
        FROM public.historial_clinico
        WHERE observaciones LIKE %s
        ORDER BY fecha, id
        """,
        (f"%{MAIN_SOURCE_PREFIX}%",),
    )
    rows = [dict(r) for r in cur.fetchall()]
    changed = 0
    samples = []
    for row in rows:
        ant, mot, tto = clean_record_fields(
            row.get("antecedentes_personales") or row.get("descripcion"),
            row.get("motivo_consulta"),
            row.get("tratamiento"),
        )
        orig = (
            (row.get("antecedentes_personales") or "").strip(),
            (row.get("motivo_consulta") or "").strip(),
            (row.get("tratamiento") or "").strip(),
        )
        new = ((ant or "").strip(), (mot or "").strip(), (tto or "").strip())
        if orig == new:
            continue
        changed += 1
        if len(samples) < 8:
            samples.append(
                {
                    "id": row["id"],
                    "fecha": row["fecha"],
                    "before_tto": orig[2][:100],
                    "after_tto": new[2][:100],
                    "before_motivo": orig[1][:60],
                    "after_motivo": new[1][:60],
                }
            )
        if apply:
            cur.execute(
                """
                UPDATE public.historial_clinico
                SET antecedentes_personales = %s,
                    descripcion = %s,
                    motivo_consulta = %s,
                    titulo = left(coalesce(%s, 'Consulta'), 200),
                    tratamiento = %s
                WHERE id = %s::uuid
                """,
                (ant, ant, mot, mot, tto, row["id"]),
            )
    return {"scanned": len(rows), "changed": changed, "samples": samples}


def upsert_skipped_visit(
    cur: Any,
    customer: dict[str, Any],
    fecha: str,
    antecedentes: str,
    motivo: str,
    tratamiento: str,
    source_key: str,
    apply: bool,
) -> dict[str, Any]:
    cur.execute(
        """
        SELECT id::text, observaciones
        FROM public.historial_clinico
        WHERE customer_id = %s
          AND (
            observaciones LIKE %s
            OR (fecha = %s::date AND tipo = 'consulta')
          )
        ORDER BY
          CASE WHEN observaciones LIKE %s THEN 0 ELSE 1 END,
          created_at DESC NULLS LAST
        LIMIT 1
        """,
        (
            customer["id"],
            f"%import_key={source_key}%",
            fecha,
            f"%import_key={source_key}%",
        ),
    )
    existing = cur.fetchone()
    info = {
        "customer": customer.get("name"),
        "customer_id": customer["id"],
        "fecha": fecha,
        "source_key": source_key,
        "existing": bool(existing),
    }
    if not apply:
        return info
    obs = f"Importado de {SOURCE_LABEL}; import_key={source_key}"
    payload = {
        "customer_id": customer["id"],
        "company_id": COMPANY_ID,
        "fecha": fecha,
        "tipo": "consulta",
        "titulo": (motivo or "Consulta medicina estética")[:200],
        "descripcion": antecedentes or None,
        "antecedentes_personales": antecedentes or None,
        "motivo_consulta": motivo or "Consulta medicina estética",
        "tratamiento": tratamiento or None,
        "observaciones": obs,
    }
    if existing:
        cur.execute(
            """
            UPDATE public.historial_clinico
            SET fecha = %(fecha)s,
                titulo = %(titulo)s,
                descripcion = %(descripcion)s,
                antecedentes_personales = %(antecedentes_personales)s,
                motivo_consulta = %(motivo_consulta)s,
                tratamiento = %(tratamiento)s,
                observaciones = %(observaciones)s
            WHERE id = %(id)s::uuid
            """,
            {**payload, "id": existing["id"]},
        )
        info["action"] = "updated"
        info["id"] = existing["id"]
    else:
        cur.execute(
            """
            INSERT INTO public.historial_clinico (
              customer_id, company_id, fecha, tipo, titulo, descripcion,
              antecedentes_personales, motivo_consulta, tratamiento, observaciones
            ) VALUES (
              %(customer_id)s, %(company_id)s, %(fecha)s, %(tipo)s, %(titulo)s, %(descripcion)s,
              %(antecedentes_personales)s, %(motivo_consulta)s, %(tratamiento)s, %(observaciones)s
            )
            RETURNING id::text
            """,
            payload,
        )
        info["action"] = "inserted"
        info["id"] = cur.fetchone()["id"]
    return info


def db_url_from_server() -> str:
    env = Path("/root/supabase-project/.env").read_text(encoding="utf-8", errors="ignore")
    pw = None
    for line in env.splitlines():
        if line.startswith("POSTGRES_PASSWORD="):
            pw = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
    if not pw:
        raise SystemExit("POSTGRES_PASSWORD missing")
    ip = subprocess.check_output(
        ["docker", "inspect", "-f", "{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}", "supabase-db"],
        text=True,
    ).strip()
    return f"postgresql://postgres:{pw}@{ip}:5432/postgres"


def run(apply: bool) -> dict[str, Any]:
    psycopg2, extras = _require_psycopg2()
    url = db_url_from_server() if Path("/root/supabase-project/.env").exists() else os.environ["SUPABASE_DB_URL"]
    report: dict[str, Any] = {"apply": apply, "merges": [], "antelo_merge": None, "repairs": None, "skipped_imports": []}

    conn = psycopg2.connect(url)
    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            fks = fk_tables(cur)

            for spec in MERGES:
                loser = find_by_code(cur, spec["loser"])
                winner = find_by_code(cur, spec["winner"])
                if not loser:
                    report["merges"].append({"error": "loser_not_found", **spec})
                    continue
                if not winner:
                    report["merges"].append({"error": "winner_not_found", **spec})
                    continue
                if loser["id"] == winner["id"]:
                    report["merges"].append({"error": "same_customer", **spec})
                    continue
                report["merges"].append(merge_pair(cur, fks, loser, winner, spec.get("rename"), apply))

            # Antelo: merge 004674 y 008088 en la mas completa
            antelo = [find_by_code(cur, c) for c in ANTELO_CODES]
            antelo = [c for c in antelo if c]
            if len(antelo) >= 2:
                scored = sorted(antelo, key=lambda c: completeness_score(cur, c), reverse=True)
                winner, losers = scored[0], scored[1:]
                antelo_info = {"winner": {"id": winner["id"], "code": winner.get("legacy_codcli"), "name": winner.get("name")}, "losers": []}
                for loser in losers:
                    antelo_info["losers"].append(merge_pair(cur, fks, loser, winner, "Maria del Carmen Antelo Collazo", apply))
                report["antelo_merge"] = antelo_info
                antelo_customer = winner
            elif len(antelo) == 1:
                antelo_customer = antelo[0]
                report["antelo_merge"] = {"winner": antelo[0], "losers": [], "note": "solo_un_cliente"}
                if apply:
                    cur.execute(
                        "UPDATE public.customers SET name = %s WHERE id = %s",
                        ("Maria del Carmen Antelo Collazo", antelo_customer["id"]),
                    )
            else:
                antelo_customer = None
                report["antelo_merge"] = {"error": "antelo_codes_not_found"}

            # Import Antelo 18/05/2026
            if antelo_customer:
                ant = "Edad: 54\nNo AMC\nRosácea a tto con láser combinado en febrero.\nNo medicación.\nCicatriz ok.\nME: nada."
                motivo = "flacidez"
                tto = (
                    "se le comenta la posibilidad de ultraformer ya que no quiere pincharse e inductores "
                    "de colágeno para que tenga la info, Así mismo pedirá cita para indiba."
                )
                report["skipped_imports"].append(
                    upsert_skipped_visit(
                        cur,
                        antelo_customer,
                        "2026-05-18",
                        ant,
                        motivo,
                        tto,
                        f"{MAIN_SOURCE_PREFIX}:antelo:2026-05-18",
                        apply,
                    )
                )

            # Layla 21/05/2025 (del CSV original)
            layla = find_by_code(cur, LAYLA_CODE)
            if layla:
                ant = (
                    "Edad: 26\nNo AMC\nHipotiroidismo a tto con Eutirox con buen control. "
                    "No otro tto ni medicación.\nNo Iq. No problemas con AL\nNo tto médico estético.\n"
                    "Emplea serum de ordinary con glicólico."
                )
                motivo = "Arrugas de expresión, corrugadores y frontal."
                tto = (
                    "se plantea botox. Explica y firma CI. Se infiltra en orbicular, corrugador, "
                    "piramidal y frontal sin incidencias tras el procedimiento. "
                    "Se recomienda revisión en 15 días. Lot 23310-2 exp 06/26 Relfydess de galderma."
                )
                report["skipped_imports"].append(
                    upsert_skipped_visit(
                        cur,
                        layla,
                        "2025-05-21",
                        ant,
                        motivo,
                        tto,
                        f"{MAIN_SOURCE_PREFIX}:layla:2025-05-21",
                        apply,
                    )
                )
            else:
                report["skipped_imports"].append({"error": "layla_not_found", "code": LAYLA_CODE})

            report["repairs"] = repair_polluted_historiales(cur, apply)

            if apply:
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--report", type=Path, default=Path("/tmp/medicina_import/post_revision_report.json"))
    args = parser.parse_args()
    report = run(args.apply)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(
        "apply" if args.apply else "dry-run",
        f"merges={len(report.get('merges') or [])}",
        f"repairs={(report.get('repairs') or {}).get('changed')}",
        f"skipped_imports={len(report.get('skipped_imports') or [])}",
        f"report={args.report}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
