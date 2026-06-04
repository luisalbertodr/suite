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
    skip_catalog: bool,
    with_customers: bool,
    no_invoices: bool,
    no_sales: bool,
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

        customer_steps = [
            PipelineStepDef("Clientes", lambda: py("promote_legacy_customers.py", *company_args)),
            PipelineStepDef(
                "Fechas nacimiento (fecnac)",
                lambda: py("backfill_customer_birth_dates.py", "--skip-dbf", *company_args),
            ),
            PipelineStepDef(
                "Teléfonos clientes",
                lambda: py("promote_legacy_customer_phones.py", *company_args),
            ),
            PipelineStepDef("Bonos cliente", lambda: py("promote_legacy_bonoscli.py", *company_args)),
        ]

        if mode == "full" and not skip_master:
            if not skip_catalog:
                steps.extend(
                    [
                        PipelineStepDef("Catálogo", lambda: py("promote_legacy_catalog.py", *company_args)),
                        PipelineStepDef(
                            "Cobertura bonos",
                            lambda: py("promote_legacy_bonus_coverage.py", *company_args),
                        ),
                    ]
                )
            steps.extend(customer_steps)

        if mode in {"refresh", "promote-only"} and with_customers:
            steps.extend(customer_steps)

        planinc_args = list(company_args)
        if clean_import:
            planinc_args.append("--clean-import")

        promote_tail: list[PipelineStepDef] = [
            PipelineStepDef(
                "Citas agenda (plan2009)",
                lambda: py("promote_legacy_planinc_to_agenda.py", *planinc_args),
            ),
            PipelineStepDef(
                "Enlace customer_id",
                lambda: py("link_agenda_customer_ids.py", *company_args),
            ),
        ]

        if not no_sales:
            sales_args = list(company_args)
            if include_fallback:
                sales_args.append("--include-fallback")
            promote_tail.append(
                PipelineStepDef(
                    "Ventas legacy (impcob)",
                    lambda: py("promote_legacy_agenda_sales.py", *sales_args),
                ),
            )

        if not no_invoices:
            promote_tail.extend(
                [
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
                ],
            )

        steps.extend(promote_tail)

    return steps
