"""Marca legacy_import_runs colgados (running/queued) como failed."""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import psycopg2
from psycopg2.extras import RealDictCursor

from legacy_import_progress import ensure_db_connection
from legacy_import_run_tracker import RunTracker

FAIL_MSG = "Detenido manualmente (todas las importaciones en ejecución)"


def list_active_runs(conn, company_id: str | None) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if company_id:
            cur.execute(
                """
                SELECT id, company_id, mode, status, current_step, created_at
                FROM public.legacy_import_runs
                WHERE status IN ('running', 'queued')
                  AND company_id = %s::uuid
                ORDER BY created_at DESC
                """,
                (company_id,),
            )
        else:
            cur.execute(
                """
                SELECT id, company_id, mode, status, current_step, created_at
                FROM public.legacy_import_runs
                WHERE status IN ('running', 'queued')
                ORDER BY created_at DESC
                """
            )
        return [dict(r) for r in cur.fetchall()]


def main() -> None:
    os.environ["SUPABASE_DB_URL"] = ensure_db_connection()
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", help="UUID concreto")
    ap.add_argument(
        "--all-running",
        action="store_true",
        help="Detener todos los runs en running o queued",
    )
    ap.add_argument("--company-id", default="", help="Filtrar por empresa (opcional)")
    ap.add_argument("--include-queued", action="store_true", help="Incluir también queued")
    args = ap.parse_args()

    if not args.run_id and not args.all_running:
        ap.error("Indique --run-id <uuid> o --all-running")

    company_id = args.company_id.strip() or None
    statuses = ("running", "queued") if args.include_queued or args.all_running else ("running",)

    if args.run_id:
        tracker = RunTracker(args.run_id)
        run = tracker.load_run()
        if not run:
            sys.exit(f"Run no encontrado: {args.run_id}")
        print(f"Estado actual: {run.get('status')}  paso: {run.get('current_step')}")
        tracker.mark_failed(FAIL_MSG)
        print("OK → failed:", args.run_id)
        return

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=15)
    conn.autocommit = True
    try:
        runs = list_active_runs(conn, company_id)
        if not runs:
            print("No hay importaciones en running/queued.")
            return

        print(f"Deteniendo {len(runs)} ejecución(es)…")
        for run in runs:
            rid = str(run["id"])
            print(
                f"  - {rid}  [{run.get('status')}]  {run.get('mode')}  "
                f"{run.get('current_step') or '(sin paso)'}"
            )
            RunTracker(rid).mark_failed(FAIL_MSG)
        print(f"OK → {len(runs)} run(s) marcados como failed.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
