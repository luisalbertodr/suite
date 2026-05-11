"""
Importa leads de Meta (Facebook/Instagram Lead Ads) a public.marketing_leads.

Acepta tanto el formato del Graph API:
    { "data": [ { "id": "...", "created_time": "...", "field_data": [...] } ], "paging": {...} }
como un array plano de leads.

Variables de entorno:
    SUPABASE_DB_URL=postgresql://...
    LEGACY_COMPANY_ID=<uuid de la empresa>
    META_LEADS_JSON=<ruta al archivo JSON>            (opcional, default: leads_body.json)
    META_DEFAULT_STAGE=<nombre de etapa a usar>       (opcional, default: 'Nuevo Formulario')
    META_DRY_RUN=0|1                                   (opcional, default: 0)

Uso (PowerShell):
    $env:LEGACY_COMPANY_ID = "<uuid-empresa>"
    $env:META_LEADS_JSON   = "C:/Users/OportoW11/Desktop/leads_body.json"
    python scripts/import_meta_leads.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import psycopg2
from psycopg2.extras import Json

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


STANDARD_FIELDS = {"first_name", "last_name", "full_name", "phone_number", "phone", "email"}


def _normalize_field_name(name: str | None) -> str:
    if not name:
        return ""
    return name.strip().lower().replace(" ", "_")


def _first_value(values: Any) -> str | None:
    if not isinstance(values, list) or not values:
        return None
    v = str(values[0] or "").strip()
    return v or None


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # "2026-05-11T13:10:06+0000" → "2026-05-11T13:10:06+00:00"
        v = value.strip()
        if v.endswith("Z"):
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        if len(v) >= 5 and (v[-5] in "+-") and v[-3] != ":":
            v = v[:-2] + ":" + v[-2:]
        return datetime.fromisoformat(v)
    except ValueError:
        return None


def parse_meta_lead(raw: dict) -> dict:
    fields = raw.get("field_data") or []
    first_name = last_name = phone = email = None
    extra: list[dict] = []

    for f in fields:
        key = _normalize_field_name(f.get("name"))
        value = _first_value(f.get("values"))
        if not key:
            continue
        if key == "first_name":
            first_name = value
        elif key == "last_name":
            last_name = value
        elif key == "full_name" and value:
            parts = value.split()
            first_name = first_name or (parts[0] if parts else None)
            if len(parts) > 1 and not last_name:
                last_name = " ".join(parts[1:])
        elif key in {"phone_number", "phone"}:
            phone = value
        elif key == "email":
            email = value
        else:
            extra.append({"name": key, "values": list(f.get("values") or [])})

    platform = (raw.get("platform") or "").lower()
    if "instagram" in platform:
        source = "instagram"
    elif "facebook" in platform:
        source = "facebook"
    else:
        source = "meta"

    return {
        "external_id": raw.get("id"),
        "external_created_at": _parse_iso(raw.get("created_time")),
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "email": email,
        "form_name": raw.get("form_name"),
        "campaign": raw.get("campaign_name"),
        "source": source,
        "field_data": extra,
    }


def load_payload(path: Path) -> Iterable[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        data = raw.get("data")
        if isinstance(data, list):
            return data
    raise SystemExit("Formato JSON no reconocido: se esperaba { 'data': [...] } o un array")


def main() -> int:
    load_dotenv()

    db_url = os.environ.get("SUPABASE_DB_URL")
    company_id = os.environ.get("LEGACY_COMPANY_ID")
    json_path_str = os.environ.get("META_LEADS_JSON") or "leads_body.json"
    default_stage_name = os.environ.get("META_DEFAULT_STAGE") or "Nuevo Formulario"
    dry_run = os.environ.get("META_DRY_RUN", "0").strip() in {"1", "true", "yes"}

    if not db_url:
        print("Falta SUPABASE_DB_URL", file=sys.stderr)
        return 1
    if not company_id:
        print("Falta LEGACY_COMPANY_ID", file=sys.stderr)
        return 1

    json_path = Path(json_path_str)
    if not json_path.is_absolute():
        json_path = ROOT / json_path
    if not json_path.is_file():
        print(f"No se encuentra el archivo JSON: {json_path}", file=sys.stderr)
        return 1

    leads_raw = list(load_payload(json_path))
    parsed = [parse_meta_lead(item) for item in leads_raw]
    print(f"Leídos {len(parsed)} leads desde {json_path}")

    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM public.marketing_lead_stages
                WHERE company_id = %s AND name = %s
                LIMIT 1
                """,
                (company_id, default_stage_name),
            )
            row = cur.fetchone()
            if not row:
                cur.execute(
                    """
                    SELECT id FROM public.marketing_lead_stages
                    WHERE company_id = %s
                    ORDER BY position
                    LIMIT 1
                    """,
                    (company_id,),
                )
                row = cur.fetchone()
            stage_id = row[0] if row else None
            if stage_id is None:
                print(
                    "Aviso: la empresa no tiene etapas. Los leads se importarán sin etapa.",
                    file=sys.stderr,
                )

            ext_ids = [p["external_id"] for p in parsed if p.get("external_id")]
            existing: set[str] = set()
            if ext_ids:
                cur.execute(
                    """
                    SELECT external_id FROM public.marketing_leads
                    WHERE company_id = %s AND external_id = ANY(%s)
                    """,
                    (company_id, ext_ids),
                )
                existing = {r[0] for r in cur.fetchall() if r[0]}

            inserted = 0
            skipped = 0
            for p in parsed:
                ext = p["external_id"]
                if ext and ext in existing:
                    skipped += 1
                    continue
                params = (
                    company_id,
                    stage_id,
                    ext,
                    p["source"],
                    p["form_name"],
                    p["campaign"],
                    p["first_name"],
                    p["last_name"],
                    p["phone"],
                    p["email"],
                    Json(p["field_data"]),
                    p["external_created_at"],
                )
                if dry_run:
                    inserted += 1
                    continue
                cur.execute(
                    """
                    INSERT INTO public.marketing_leads (
                      company_id, stage_id, external_id, source, form_name, campaign,
                      first_name, last_name, phone, email, field_data, external_created_at
                    ) VALUES (
                      %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (company_id, external_id) DO NOTHING
                    """,
                    params,
                )
                inserted += cur.rowcount

        if not dry_run:
            conn.commit()

    print(
        f"Importación completada: {inserted} insertados · {skipped} duplicados omitidos"
        + (" (dry-run)" if dry_run else "")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
