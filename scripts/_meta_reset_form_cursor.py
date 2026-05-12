"""Resetea last_lead_created_time / last_lead_external_id de los formularios Meta
para forzar a la siguiente sync a recorrer todos los leads desde el principio.

Uso: python scripts/_meta_reset_form_cursor.py
"""

from __future__ import annotations

from pathlib import Path

import psycopg2


def load_db_url() -> str:
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("SUPABASE_DB_URL="):
            return s.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_DB_URL no encontrada en .env")


def main() -> int:
    with psycopg2.connect(load_db_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.meta_forms
                SET last_lead_created_time = NULL,
                    last_lead_external_id = NULL
                RETURNING form_id, form_name
                """
            )
            rows = cur.fetchall()
        conn.commit()
    print(f"Cursor reseteado en {len(rows)} formulario(s):")
    for fid, name in rows:
        print(f"  - {fid} ({name})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
