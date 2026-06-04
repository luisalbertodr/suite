"""Resuelve empresa emisora (Estética/Medicina) desde líneas legacy.faclin."""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from legacy_company import DEFAULT_COMPANY_ID, MEDICINA_COMPANY_ID


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def faccab_legacy_key(row: dict) -> str:
    return (
        f"{str(row.get('serfac') or '').strip() or 'BLANK'}|"
        f"{str(row.get('ejefac') or '').strip() or '0'}|"
        f"{str(row.get('numfac') or '').strip() or '0'}"
    )


def load_article_billing_map(cur, catalog_company_id: str, default_billing_id: str) -> dict[str, str]:
    cur.execute(
        """
        SELECT
          a.codigo,
          a.legacy_codart,
          COALESCE(a.billing_company_id, af.billing_company_id, %s::uuid)::text AS billing_company_id
        FROM public.articles a
        LEFT JOIN public.article_families af
          ON af.company_id = a.company_id AND af.name = a.familia
        WHERE a.company_id = %s::uuid
        """,
        (default_billing_id, catalog_company_id),
    )
    out: dict[str, str] = {}
    for row in cur.fetchall():
        billing = str(row["billing_company_id"] or default_billing_id)
        for raw in (row.get("codigo"), row.get("legacy_codart")):
            key = str(raw or "").strip().upper()
            if key:
                out[key] = billing
    return out


def load_faclin_by_key(cur) -> dict[str, list[dict]]:
    cur.execute("SELECT to_regclass('legacy.faclin') AS t")
    if not cur.fetchone()["t"]:
        return {}
    cur.execute(
        """
        SELECT serfac, ejefac, numfac, codart, subtot, preven, cant
        FROM legacy.faclin
        """
    )
    out: dict[str, list[dict]] = defaultdict(list)
    for row in cur.fetchall():
        key = faccab_legacy_key(row)
        out[key].append(dict(row))
    return out


def resolve_faccab_billing_company(
    row: dict,
    faclin_by_key: dict[str, list[dict]],
    article_map: dict[str, str],
    *,
    estetica_id: str = DEFAULT_COMPANY_ID,
    medicina_id: str = MEDICINA_COMPANY_ID,
) -> str:
    """Empresa con mayor importe en líneas; si no hay líneas, estética."""
    lines = faclin_by_key.get(faccab_legacy_key(row), [])
    amounts: defaultdict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for line in lines:
        cod = str(line.get("codart") or "").strip().upper()
        billing = article_map.get(cod, estetica_id)
        total = money(line.get("subtot"))
        if total == 0:
            qty = money(line.get("cant") or 1)
            total = money(line.get("preven")) * qty
        amounts[billing] += abs(total)
    if not amounts and row.get("totfac"):
        amounts[estetica_id] += abs(money(row.get("totfac")))
    if not amounts:
        return estetica_id
    return max(amounts.items(), key=lambda item: item[1])[0]
