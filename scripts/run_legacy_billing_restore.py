#!/usr/bin/env python3
"""
Orquesta la restauración de cobros/facturas legacy y cierres de caja Dunasoft.

Orden:
  1. link_agenda_customer_ids
  2. promote_legacy_agenda_sales (tickets LEG-*)
  3. promote_legacy_sales_invoices
  4. promote_legacy_unmatched_faccab
  5. rebuild_legacy_invoices_sequential (numeración F{YYYY}-{NNNNN})
  6. promote_legacy_cash_register

Por defecto no toca citas/tickets/facturas de hoy en adelante (--no-auto-from hoy).

Uso:
  python scripts/run_legacy_billing_restore.py --dry-run
  python scripts/run_legacy_billing_restore.py --apply
  python scripts/run_legacy_billing_restore.py --apply --skip-cash
  python scripts/run_legacy_billing_restore.py --apply --only renumber,cash
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from legacy_billing_common import (
    default_auto_invoice_through,
    default_no_auto_from,
    load_dotenv,
)
from legacy_company import MEDICINA_COMPANY_ID

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable

STEPS = (
    "link",
    "sales",
    "invoices",
    "unmatched",
    "renumber",
    "cash",
)


def run_step(name: str, argv: list[str], dry_run: bool) -> int:
    cmd = [PYTHON, str(ROOT / "scripts" / argv[0])] + argv[1:]
    if dry_run and "--dry-run" not in cmd and name not in ("link",):
        if "--apply" in cmd:
            cmd = [c for c in cmd if c != "--apply"]
        cmd.append("--dry-run")
    print(f"\n=== {name} ===\n$ {' '.join(cmd)}", flush=True)
    proc = subprocess.run(cmd, cwd=str(ROOT), env=os.environ.copy())
    if proc.returncode != 0:
        print(f"ERROR en paso {name} (código {proc.returncode})", file=sys.stderr)
    return proc.returncode


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--company-id", default="")
    ap.add_argument(
        "--through",
        default="",
        help=f"Última fecha histórica incluida (default ayer: {default_auto_invoice_through().isoformat()})",
    )
    ap.add_argument(
        "--no-auto-from",
        default="",
        help=f"Sin auto desde (default hoy: {default_no_auto_from().isoformat()})",
    )
    ap.add_argument("--skip-cash", action="store_true")
    ap.add_argument("--skip-renumber", action="store_true")
    ap.add_argument(
        "--only",
        default="",
        help=f"Pasos separados por coma: {','.join(STEPS)}",
    )
    ap.add_argument(
        "--cash-profile",
        choices=("estetica", "medicina"),
        default="",
        help="Perfil de importación caja Dunasoft (default: medicina si company-id es Medicina)",
    )
    args = ap.parse_args()

    if not args.apply and not args.dry_run:
        print("Indica --dry-run o --apply", file=sys.stderr)
        return 2

    dry_run = args.dry_run and not args.apply
    through = (args.through or "").strip() or default_auto_invoice_through().isoformat()
    no_auto = (args.no_auto_from or "").strip() or default_no_auto_from().isoformat()
    company = (args.company_id or "").strip()
    cash_profile = (args.cash_profile or "").strip()
    if not cash_profile and company == MEDICINA_COMPANY_ID:
        cash_profile = "medicina"
    elif not cash_profile:
        cash_profile = "estetica"

    only = {s.strip() for s in args.only.split(",") if s.strip()} if args.only else set(STEPS)
    date_args = ["--through", through, "--no-auto-from", no_auto]
    company_args = ["--company-id", company] if company else []

    def want(step: str) -> bool:
        return step in only

    plan: list[tuple[str, list[str]]] = []
    if want("link"):
        link_argv = ["link_agenda_customer_ids.py"]
        if dry_run:
            link_argv.append("--dry-run")
        if company:
            link_argv.extend(company_args)
        plan.append(("link", link_argv))

    if want("sales"):
        plan.append(
            (
                "sales",
                ["promote_legacy_agenda_sales.py"] + company_args + date_args
                + (["--dry-run"] if dry_run else []),
            )
        )
    if want("invoices"):
        plan.append(
            (
                "invoices",
                ["promote_legacy_sales_invoices.py"] + company_args + date_args
                + (["--dry-run"] if dry_run else []),
            )
        )
    if want("unmatched"):
        plan.append(
            (
                "unmatched",
                ["promote_legacy_unmatched_faccab.py"] + company_args + date_args
                + (["--dry-run"] if dry_run else []),
            )
        )
    if want("renumber") and not args.skip_renumber:
        ren_argv = ["rebuild_legacy_invoices_sequential.py"] + company_args + [
            "--no-auto-from",
            no_auto,
            "--through",
            through,
        ]
        if args.apply:
            ren_argv.append("--apply")
        else:
            ren_argv.append("--dry-run")
        plan.append(("renumber", ren_argv))

    if want("cash") and not args.skip_cash:
        cash_argv = ["promote_legacy_cash_register.py"] + company_args + [
            "--no-auto-from",
            no_auto,
            "--cash-profile",
            cash_profile,
        ]
        if args.apply:
            cash_argv.append("--apply")
        else:
            cash_argv.append("--dry-run")
        plan.append(("cash", cash_argv))

    print(
        f"Plan legacy billing ({'DRY-RUN' if dry_run else 'APPLY'}): "
        f"through={through} no_auto_from={no_auto}"
    )
    for name, argv in plan:
        rc = run_step(name, argv, dry_run)
        if rc != 0:
            return rc

    print("\nPipeline completado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
