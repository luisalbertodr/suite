"""Utilidades compartidas para importación legacy (corte de fechas, fechas Dunasoft)."""
from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"


def load_dotenv() -> None:
    if not ENV_PATH.is_file():
        return
    for line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def norm_date(value) -> str | None:
    v = str(value or "").strip()
    if len(v) == 8 and v.isdigit():
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}"
    if len(v) >= 10 and v[4] == "-":
        return v[:10]
    return None


def default_auto_invoice_through() -> date:
    """Último día que se factura automáticamente (ayer por defecto)."""
    raw = os.environ.get("LEGACY_AUTO_INVOICE_THROUGH", "").strip()
    if raw:
        return date.fromisoformat(raw[:10])
    return date.today() - timedelta(days=1)


def default_no_auto_from() -> date:
    """Desde este día (inclusive) no se crean tickets/facturas automáticas."""
    raw = os.environ.get("LEGACY_NO_AUTO_FROM", "").strip()
    if raw:
        return date.fromisoformat(raw[:10])
    return date.today()


def date_before_cutoff(d: str | None, cutoff_exclusive: date) -> bool:
    """True si d es una fecha válida estrictamente anterior al corte."""
    if not d:
        return False
    try:
        return date.fromisoformat(d[:10]) < cutoff_exclusive
    except ValueError:
        return False
