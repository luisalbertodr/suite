"""
Ejecuta un pipeline legacy_import_runs encolado desde la UI.

Reanuda automáticamente runs en estado failed (omite pasos ya completados).

Uso:
  python scripts/legacy_import_worker.py --run-id <uuid>
  python scripts/legacy_import_worker.py --run-id <uuid> --no-resume
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from legacy_import_progress import ensure_db_connection
from legacy_import_run_tracker import RunTracker
from legacy_company import get_company_id


def main() -> None:
    os.environ["SUPABASE_DB_URL"] = ensure_db_connection()
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", required=True)
    ap.add_argument(
        "--force",
        action="store_true",
        help="Reanudar aunque el run esté en running (proceso colgado/interrumpido)",
    )
    ap.add_argument(
        "--no-resume",
        action="store_true",
        help="Ejecutar todos los pasos desde el inicio (no omitir completados)",
    )
    ap.add_argument(
        "--resume-from",
        default="",
        help="Reanudar desde un paso concreto",
    )
    args = ap.parse_args()
    os.environ["LEGACY_IMPORT_RUN_ID"] = args.run_id
    os.environ.setdefault("PYTHONUNBUFFERED", "1")

    tracker = RunTracker(args.run_id)
    run = tracker.load_run()
    if not run:
        sys.exit(f"Run no encontrado: {args.run_id}")

    status = str(run.get("status") or "")
    stale = tracker.is_stale_running()
    if status == "running" and (args.force or stale):
        print(
            "Run en running pero sin actividad reciente; reanudando"
            + (" (forzado)" if args.force else " (stale)"),
        )
        status = "failed"  # tratar como reanudable
    elif status not in {"queued", "failed"}:
        print(f"Run en estado {run.get('status')}; omitiendo.")
        print("Use --force si el proceso ya no está corriendo en el servidor.")
        return

    resumable = status in {"failed", "running"} or (str(run.get("status") or "") == "running" and (args.force or stale))
    auto_resume = resumable and not args.no_resume
    if auto_resume:
        done = tracker.get_completed_steps()
        print(f"Reanudando run fallido; omitiendo {len(done)} paso(s) completado(s).")

    mode = run.get("mode") or "refresh"
    options = run.get("options") or {}
    company_id = str(run.get("company_id") or get_company_id())

    tracker.start(resume=auto_resume or bool(args.resume_from))
    try:
        import legacy_import_pipeline as pipeline

        pipeline.execute_pipeline(
            mode=mode,
            dry_run=False,
            skip_master=bool(options.get("skipMaster")),
            skip_catalog=bool(options.get("skip_catalog")),
            with_customers=bool(options.get("withCustomers") or options.get("with_customers")),
            no_invoices=bool(options.get("no_invoices")),
            no_sales=bool(options.get("no_sales")),
            clean_import=bool(options.get("cleanImport") or options.get("clean_import")),
            include_fallback=bool(options.get("includeFallback")),
            company_id=company_id,
            tracker=tracker,
            resume=auto_resume or bool(args.resume_from),
            resume_from=args.resume_from or None,
        )
        tracker.complete()
        print("Worker completado.")
    except SystemExit as exc:
        tracker.fail(str(exc))
        raise
    except Exception as exc:
        tracker.fail(str(exc))
        raise
    finally:
        tracker.close()


if __name__ == "__main__":
    main()
