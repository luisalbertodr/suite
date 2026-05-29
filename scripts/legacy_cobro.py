"""Utilidades compartidas para importes cobrados vs facturados en legacy Dunasoft."""
from __future__ import annotations

from decimal import Decimal


def parse_decimal(value) -> Decimal:
    s = str(value or "").strip().replace(",", ".")
    if not s:
        return Decimal("0")
    try:
        return Decimal(s)
    except Exception:
        return Decimal("0")


def truthy_legacy(value) -> bool:
    s = str(value or "").strip().upper()
    return s in {"S", "SI", "1", "T", "TRUE", "Y", "YES", "X"}


def norm_cli_key(codcli: str) -> str:
    c = str(codcli or "").strip()
    return c.lstrip("0") or "0"


def cli_lookup_keys(codcli: str) -> list[str]:
    raw = str(codcli or "").strip()
    if not raw:
        return []
    keys = [raw, norm_cli_key(raw)]
    if raw.isdigit():
        keys.append(raw.zfill(6))
    return list(dict.fromkeys(keys))


def norm_date(value) -> str | None:
    v = str(value or "").strip()
    if len(v) == 8 and v.isdigit():
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}"
    if len(v) >= 10 and v[4] == "-":
        return v[:10]
    return None


def faccab_impcob(row: dict) -> Decimal:
    return parse_decimal(row.get("impcob1")) + parse_decimal(row.get("impcob2"))


def is_faccab_serie_a(row: dict) -> bool:
    ser = str(row.get("serfac") or "").strip().upper()
    return ser in {"", "A"}


def paid_in_full(cobrado: Decimal, facturado: Decimal) -> bool:
    if facturado <= 0:
        return cobrado > 0
    return cobrado + Decimal("0.02") >= facturado
