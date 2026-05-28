"""Company ID por defecto para scripts de importación y promoción legacy."""
from __future__ import annotations

import os

DEFAULT_COMPANY_ID = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

# Alias para compatibilidad con scripts antiguos
DEFAULT_COMPANY = DEFAULT_COMPANY_ID


def get_company_id(*env_keys: str) -> str:
    """Lee company_id de entorno; si no está, usa DEFAULT_COMPANY_ID."""
    keys = env_keys or ("LEGACY_COMPANY_ID", "PROMOTE_COMPANY_ID", "COMPANY_ID")
    for key in keys:
        val = os.environ.get(key, "").strip()
        if val:
            return val
    return DEFAULT_COMPANY_ID
