"""
Pipeline unificado de reimportación legacy Dunasoft → Suite.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import TYPE_CHECKING

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


def run_step(
    name: str,
    cmd: list[str],
    dry_run: bool,
    tracker: RunTracker | None = None,
) -> None:
    printable = " ".join(cmd)
    print(f"\n{'=' * 72}\n>>> {name}\n    {printable}\n{'=' * 72}")
    if tracker:
        tracker.step(name, printable)
    if dry_run:
        print("[dry-run] omitido")
        return
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        raise SystemExit(f"Paso fallido ({name}): código {result.returncode}")


def py(script: str, *args: str) -> list[str]:
    return [sys.executable, str(SCRIPTS / script), *args]


def execute_pipeline(
    *,
    mode: str,
    dry_run: bool,
    skip_master: bool,
    clean_import: bool,
    include_fallback: bool,
    company_id: str,
    tracker: RunTracker | None = None,
) -> None:
    company_args = ["--company-id", company_id] if company_id else []

    if mode in {"staging", "refresh", "full"}:
        scope = os.environ.get("LEGACY_IMPORT_SCOPE", "all").strip() or "all"
        print(f"Import DBF → legacy.* (LEGACY_IMPORT_SCOPE={scope})")
        run_step("DBF import", py("legacy_dbf_import_wave1.py"), dry_run, tracker)
        run_step("Bonos artículos", py("import_legacy_bonosart.py"), dry_run, tracker)

    if mode in {"refresh", "full", "promote-only"}:
        if mode in {"refresh", "full"}:
            reset_scope = "all" if clean_import else "appointments"
            run_step(
                f"Reset public legacy ({reset_scope})",
                py("reset_legacy_public_data.py", "--scope", reset_scope, *company_args),
                dry_run,
                tracker,
            )

        if mode == "full" and not skip_master:
            run_step("Catálogo", py("promote_legacy_catalog.py", *company_args), dry_run, tracker)
            run_step("Cobertura bonos", py("promote_legacy_bonus_coverage.py", *company_args), dry_run, tracker)
            run_step("Clientes", py("promote_legacy_customers.py", *company_args), dry_run, tracker)
            run_step("Teléfonos clientes", py("promote_legacy_customer_phones.py", *company_args), dry_run, tracker)
            run_step("Bonos cliente", py("promote_legacy_bonoscli.py", *company_args), dry_run, tracker)

        planinc_args = list(company_args)
        if clean_import:
            planinc_args.append("--clean-import")
        run_step("Citas planinc", py("promote_legacy_planinc_to_agenda.py", *planinc_args), dry_run, tracker)
        run_step("Enlace customer_id", py("link_agenda_customer_ids.py", *company_args), dry_run, tracker)

        sales_args = list(company_args)
        if include_fallback:
            sales_args.append("--include-fallback")
        run_step("Ventas legacy (impcob)", py("promote_legacy_agenda_sales.py", *sales_args), dry_run, tracker)
        run_step("Facturas legacy", py("promote_legacy_sales_invoices.py", *company_args), dry_run, tracker)
        run_step("Corregir fechas factura", py("fix_legacy_invoice_dates.py", *company_args), dry_run, tracker)

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
    ap.add_argument("--clean-import", action="store_true")
    ap.add_argument("--include-fallback", action="store_true")
    ap.add_argument("--company-id", default=os.environ.get("PROMOTE_COMPANY_ID", ""))
    ap.add_argument("--run-id", default="", help="UUID legacy_import_runs (actualiza progreso UI)")
    args = ap.parse_args()

    if not os.environ.get("SUPABASE_DB_URL", "").strip():
        sys.exit("Falta SUPABASE_DB_URL en .env")

    from legacy_import_run_tracker import RunTracker

    tracker = RunTracker(args.run_id or None)
    if tracker.active and not args.dry_run:
        tracker.start()

    try:
        execute_pipeline(
            mode=args.mode,
            dry_run=args.dry_run,
            skip_master=args.skip_master,
            clean_import=args.clean_import,
            include_fallback=args.include_fallback,
            company_id=args.company_id,
            tracker=tracker if tracker.active and not args.dry_run else None,
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
