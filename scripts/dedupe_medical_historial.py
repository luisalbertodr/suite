#!/usr/bin/env python3
"""Elimina consultas duplicadas del import de Fichas medicina.csv (v1 vs v2).

Agrupa por (customer_id, fecha) y agrupa filas con contenido similar.
En cada grupo conserva la mejor (cita enlazada > v2 > texto más rico > más reciente)
y borra el resto.

Uso:
  python scripts/dedupe_medical_historial.py --dry-run
  python scripts/dedupe_medical_historial.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OBS_MARK = "%Fichas medicina.csv%"


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def norm_text(value: str | None) -> str:
    text = re.sub(r"\s+", " ", (value or "").strip().lower())
    return text


def fingerprint(row: dict[str, Any]) -> str:
    motivo = norm_text(row.get("motivo_consulta") or row.get("titulo"))
    tto = norm_text(row.get("tratamiento"))[:120]
    # Si el tto está contaminado con cabeceras, basarse más en motivo
    if "motivo consulta" in tto or tto.startswith("día "):
        tto = ""
    if not motivo and not tto:
        return f"empty:{row['id']}"
    return f"{motivo}|{tto}"


def same_visit(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Misma visita del CSV aunque el texto v1/v2 difiera un poco."""
    if fingerprint(a) == fingerprint(b):
        return True
    ma = norm_text(a.get("motivo_consulta") or a.get("titulo"))
    mb = norm_text(b.get("motivo_consulta") or b.get("titulo"))
    # Unificar tilde estetica/estética
    ma_n = ma.replace("estetica", "estética")
    mb_n = mb.replace("estetica", "estética")
    generic = {
        "consulta medicina estética",
        "consulta medicina estetica",
        "revisión",
        "revision",
    }
    ta = norm_text(a.get("tratamiento"))
    tb = norm_text(b.get("tratamiento"))
    ta80, tb80 = ta[:80], tb[:80]
    tto_similar = bool(ta80 and tb80 and (ta80.startswith(tb[:40]) or tb80.startswith(ta[:40])))
    if ma_n and mb_n and ma_n == mb_n:
        if ma_n not in generic:
            return True
        # Motivo genérico: solo si el tratamiento encaja
        if tto_similar or (not ta and not tb):
            return True
    if tto_similar and (not ma_n or not mb_n or ma_n in generic or mb_n in generic or ma_n == mb_n):
        return True
    return False


def cluster_rows(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    clusters: list[list[dict[str, Any]]] = []
    for row in rows:
        placed = False
        for cluster in clusters:
            if any(same_visit(row, other) for other in cluster):
                cluster.append(row)
                placed = True
                break
        if not placed:
            clusters.append([row])
    return clusters


def is_v2(obs: str | None) -> bool:
    return "medicina_estetica_csv_v2:" in (obs or "")


def is_polluted(row: dict[str, Any]) -> bool:
    tto = norm_text(row.get("tratamiento"))
    motivo = norm_text(row.get("motivo_consulta"))
    markers = ("motivo consulta", "antecedentes", "día ", "nombre ", "edad ")
    return any(m in tto for m in markers) or motivo.startswith("antecedentes")


def score(row: dict[str, Any]) -> tuple:
    obs = row.get("observaciones") or ""
    tto = row.get("tratamiento") or ""
    motivo = row.get("motivo_consulta") or ""
    ap = row.get("antecedentes_personales") or ""
    return (
        1 if row.get("appointment_id") else 0,
        0 if is_polluted(row) else 1,
        1 if is_v2(obs) else 0,
        len(tto) + len(motivo) + len(ap),
        str(row.get("created_at") or ""),
    )


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", default=os.environ.get("SUPABASE_DB_URL", "").strip())
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", type=Path, default=ROOT / "tmp/dedupe_medical_historial_report.json")
    args = ap.parse_args()
    if args.apply and args.dry_run:
        sys.exit("Usa --apply o --dry-run, no ambos")
    apply = bool(args.apply)
    if not args.database_url:
        sys.exit("Falta --database-url / SUPABASE_DB_URL")

    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        """
        SELECT customer_id::text, fecha::text
        FROM public.historial_clinico
        WHERE observaciones LIKE %s
        GROUP BY customer_id, fecha
        HAVING count(*) > 1
        """,
        (OBS_MARK,),
    )
    groups = [(r["customer_id"], r["fecha"]) for r in cur.fetchall()]

    keep_ids: list[str] = []
    delete_ids: list[str] = []
    samples: list[dict[str, Any]] = []

    for customer_id, fecha in groups:
        cur.execute(
            """
            SELECT id::text, customer_id::text, fecha::text, appointment_id::text,
                   titulo, motivo_consulta, tratamiento, antecedentes_personales,
                   observaciones, created_at::text
            FROM public.historial_clinico
            WHERE customer_id = %s::uuid
              AND fecha = %s::date
              AND observaciones LIKE %s
            ORDER BY created_at NULLS LAST, id
            """,
            (customer_id, fecha, OBS_MARK),
        )
        rows = [dict(r) for r in cur.fetchall()]
        if len(rows) < 2:
            continue

        clusters = cluster_rows(rows)

        group_keep: list[str] = []
        group_delete: list[str] = []
        for cluster in clusters:
            if len(cluster) == 1:
                group_keep.append(cluster[0]["id"])
                continue
            ranked = sorted(cluster, key=score, reverse=True)
            winner = ranked[0]
            group_keep.append(winner["id"])
            for loser in ranked[1:]:
                group_delete.append(loser["id"])

        # Si tras agrupar por huella quedan varias y alguna es contaminación
        # de cabeceras casi vacía de motivo útil, fusionar con la mejor del día.
        if len(group_keep) > 1:
            kept_rows = [r for r in rows if r["id"] in group_keep]
            clean = [r for r in kept_rows if not is_polluted(r)]
            dirty = [r for r in kept_rows if is_polluted(r)]
            if clean and dirty:
                for d in dirty:
                    group_keep.remove(d["id"])
                    group_delete.append(d["id"])

        keep_ids.extend(group_keep)
        delete_ids.extend(group_delete)
        if group_delete and len(samples) < 25:
            samples.append(
                {
                    "customer_id": customer_id,
                    "fecha": fecha,
                    "keep": group_keep,
                    "delete": group_delete,
                    "motivos": [r.get("motivo_consulta") for r in rows],
                }
            )

    # Borrar revisiones hijas si existen, luego historial
    deleted = 0
    if apply and delete_ids:
        # tabla opcional
        cur.execute(
            """
            SELECT to_regclass('public.historial_clinico_revisiones') IS NOT NULL AS ok
            """
        )
        if cur.fetchone()["ok"]:
            cur.execute(
                """
                DELETE FROM public.historial_clinico_revisiones
                WHERE historial_clinico_id = ANY(%s::uuid[])
                """,
                (delete_ids,),
            )
        cur.execute(
            """
            DELETE FROM public.historial_clinico
            WHERE id = ANY(%s::uuid[])
            """,
            (delete_ids,),
        )
        deleted = cur.rowcount
        conn.commit()
    else:
        conn.rollback()

    report = {
        "apply": apply,
        "dup_groups": len(groups),
        "keep": len(keep_ids),
        "delete_planned": len(delete_ids),
        "deleted": deleted,
        "samples": samples,
        "delete_ids": delete_ids,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("apply", "dup_groups", "keep", "delete_planned", "deleted")}, indent=2))
    print(f"Report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
