"""
Pipeline unificado de reimportación legacy Dunasoft → Suite.

Reanudar tras fallo:
  python scripts/legacy_import_pipeline.py --run-id <uuid> --resume
  python scripts/legacy_import_worker.py --run-id <uuid>   # reanuda failed automáticamente
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from legacy_import_step_defs import PipelineStepDef, build_pipeline_step_list

if TYPE_CHECKING:
    from legacy_import_run_tracker import RunTracker

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


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


def py(script: str, *args: str) -> list[str]:
    return [sys.executable, str(SCRIPTS / script), *args]


def run_step(
    name: str,
    cmd: list[str],
    dry_run: bool,
    tracker: RunTracker | None = None,
) -> None:
    printable = " ".join(cmd)
    print(f"\n{'=' * 72}\n>>> {name}\n    {printable}\n{'=' * 72}")
    if tracker:
        tracker.step_start(name, printable)
    if dry_run:
        print("[dry-run] omitido")
        if tracker:
            tracker.step_done(name)
        return
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        raise SystemExit(f"Paso fallido ({name}): código {result.returncode}")
    if tracker:
        tracker.step_done(name)


def should_skip_step(
    name: str,
    *,
    resume: bool,
    resume_from: str | None,
    completed: set[str],
    skipping_until: list[bool],
) -> bool:
    if resume_from:
        if name == resume_from:
            skipping_until[0] = False
            return False
        if skipping_until[0]:
            print(f"[resume] omitido (antes de «{resume_from}»): {name}")
            return True
        return False

    if resume and name in completed:
        print(f"[resume] omitido (ya completado): {name}")
        return True
    return False


def execute_pipeline(
    *,
    mode: str,
    dry_run: bool,
    skip_master: bool,
    skip_catalog: bool,
    with_customers: bool,
    no_invoices: bool,
    no_sales: bool,
    clean_import: bool,
    include_fallback: bool,
    company_id: str,
    tracker: RunTracker | None = None,
    resume: bool = False,
    resume_from: str | None = None,
) -> None:
    if mode in {"staging", "refresh", "full"} and not resume:
        scope = os.environ.get("LEGACY_IMPORT_SCOPE", "all").strip() or "all"
        print(f"Import DBF -> legacy.* (LEGACY_IMPORT_SCOPE={scope})")

    completed: set[str] = set()
    if resume and tracker:
        completed = tracker.get_completed_steps()
        if completed:
            print(f"[resume] pasos ya completados ({len(completed)}): {', '.join(sorted(completed))}")
        if resume_from:
            print(f"[resume] continuar desde: {resume_from}")

    steps: list[PipelineStepDef] = build_pipeline_step_list(
        mode=mode,
        skip_master=skip_master,
        skip_catalog=skip_catalog,
        with_customers=with_customers,
        no_invoices=no_invoices,
        no_sales=no_sales,
        clean_import=clean_import,
        include_fallback=include_fallback,
        company_id=company_id,
        py=py,
    )

    skipping_until = [bool(resume_from)]
    step_total = len(steps)
    step_idx = 0
    for step in steps:
        if should_skip_step(
            step.name,
            resume=resume,
            resume_from=resume_from,
            completed=completed,
            skipping_until=skipping_until,
        ):
            continue
        step_idx += 1
        print(f"\n[Paso {step_idx}/{step_total}] {step.name}", flush=True)
        if tracker:
            tracker.set_progress(step_idx, step_total, step.name)
        run_step(step.name, step.build_cmd(), dry_run, tracker)

    print("\nPipeline terminado.")
    if not dry_run:
        print("Validar: python scripts/diagnose_cobrado_vs_facturado.py")
        print("         python scripts/compare_dunasoft_revenue.py")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Pipeline reimportación legacy Dunasoft")
    ap.add_argument(
        "--mode",
        choices=["staging", "refresh", "full", "promote-only"],
        default="refresh",
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-master", action="store_true")
    ap.add_argument(
        "--skip-catalog",
        action="store_true",
        help="No promover ARTICULOS/FAMILIAS/BONOS a public (preserva Medicina en app)",
    )
    ap.add_argument(
        "--with-customers",
        action="store_true",
        help="En refresh/promote-only: actualizar clientes, fecnac, teléfonos y bonoscli",
    )
    ap.add_argument(
        "--no-invoices",
        action="store_true",
        help="No crear facturas legacy (ni faccab sueltas ni corrección fechas)",
    )
    ap.add_argument(
        "--no-sales",
        action="store_true",
        help="No crear tickets TPV LEG-* (solo citas y maestros)",
    )
    ap.add_argument("--clean-import", action="store_true")
    ap.add_argument("--include-fallback", action="store_true")
    ap.add_argument("--company-id", default=os.environ.get("PROMOTE_COMPANY_ID", ""))
    ap.add_argument("--run-id", default="", help="UUID legacy_import_runs (actualiza progreso UI)")
    ap.add_argument(
        "--resume",
        action="store_true",
        help="Omitir pasos ya completados en este run-id",
    )
    ap.add_argument(
        "--resume-from",
        default="",
        help="Reanudar desde un paso concreto (nombre exacto, p. ej. «Cobertura bonos»)",
    )
    args = ap.parse_args()

    if not os.environ.get("SUPABASE_DB_URL", "").strip():
        sys.exit("Falta SUPABASE_DB_URL en .env")

    from legacy_import_run_tracker import RunTracker

    tracker = RunTracker(args.run_id or None)
    resume = args.resume or bool(args.resume_from)
    if tracker.active and not args.dry_run:
        tracker.start(resume=resume)

    try:
        execute_pipeline(
            mode=args.mode,
            dry_run=args.dry_run,
            skip_master=args.skip_master,
            skip_catalog=args.skip_catalog,
            with_customers=args.with_customers,
            no_invoices=args.no_invoices,
            no_sales=args.no_sales,
            clean_import=args.clean_import,
            include_fallback=args.include_fallback,
            company_id=args.company_id,
            tracker=tracker if tracker.active and not args.dry_run else None,
            resume=resume,
            resume_from=args.resume_from or None,
        )
        if tracker.active and not args.dry_run:
            tracker.complete()
    except Exception as exc:
        if tracker.active and not args.dry_run:
            tracker.fail(str(exc))
        raise
    finally:
        tracker.close()


if __name__ == "__main__":
    main()
