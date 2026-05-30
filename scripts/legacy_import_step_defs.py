"""Definición ordenada de pasos del pipeline legacy."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class PipelineStepDef:
    name: str
    build_cmd: Callable[..., list[str]]


def build_pipeline_step_list(
    *,
    mode: str,
    skip_master: bool,
    clean_import: bool,
    include_fallback: bool,
    company_id: str,
    py: Callable[..., list[str]],
) -> list[PipelineStepDef]:
    company_args = ["--company-id", company_id] if company_id else []
    steps: list[PipelineStepDef] = []

    if mode in {"staging", "refresh", "full"}:
        steps.append(PipelineStepDef("DBF import", lambda: py("legacy_dbf_import_wave1.py")))
        steps.append(PipelineStepDef("Bonos artículos", lambda: py("import_legacy_bonosart.py")))

    if mode in {"refresh", "full", "promote-only"}:
        if mode in {"refresh", "full"}:
            reset_scope = "all" if clean_import else "appointments"
            steps.append(
                PipelineStepDef(
                    f"Reset public legacy ({reset_scope})",
                    lambda: py(
                        "reset_legacy_public_data.py",
                        "--scope",
                        reset_scope,
                        *company_args,
                    ),
                )
            )

        if mode == "full" and not skip_master:
            steps.extend(
                [
                    PipelineStepDef("Catálogo", lambda: py("promote_legacy_catalog.py", *company_args)),
                    PipelineStepDef(
                        "Cobertura bonos",
                        lambda: py("promote_legacy_bonus_coverage.py", *company_args),
                    ),
                    PipelineStepDef("Clientes", lambda: py("promote_legacy_customers.py", *company_args)),
                    PipelineStepDef(
                        "Teléfonos clientes",
                        lambda: py("promote_legacy_customer_phones.py", *company_args),
                    ),
                    PipelineStepDef("Bonos cliente", lambda: py("promote_legacy_bonoscli.py", *company_args)),
                ]
            )

        planinc_args = list(company_args)
        if clean_import:
            planinc_args.append("--clean-import")

        sales_args = list(company_args)
        if include_fallback:
            sales_args.append("--include-fallback")

        steps.extend(
            [
                PipelineStepDef(
                    "Citas planinc",
                    lambda: py("promote_legacy_planinc_to_agenda.py", *planinc_args),
                ),
                PipelineStepDef(
                    "Enlace customer_id",
                    lambda: py("link_agenda_customer_ids.py", *company_args),
                ),
                PipelineStepDef(
                    "Ventas legacy (impcob)",
                    lambda: py("promote_legacy_agenda_sales.py", *sales_args),
                ),
                PipelineStepDef(
                    "Facturas legacy",
                    lambda: py("promote_legacy_sales_invoices.py", *company_args),
                ),
                PipelineStepDef(
                    "Facturas faccab sin cita",
                    lambda: py("promote_legacy_unmatched_faccab.py", *company_args),
                ),
                PipelineStepDef(
                    "Corregir fechas factura",
                    lambda: py("fix_legacy_invoice_dates.py", *company_args),
                ),
            ]
        )

    return steps
