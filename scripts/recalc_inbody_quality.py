"""
Recalcula data_quality y rangos de masa grasa en todas las mediciones InBody.

Uso:
  python scripts/recalc_inbody_quality.py
  python scripts/recalc_inbody_quality.py --company-id <uuid>
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from inbody_quality import body_fat_mass_range_kg, build_data_quality

from legacy_company import get_company_id


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


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Recalcular calidad InBody en BD")
    parser.add_argument("--company-id", default=get_company_id())
    args = parser.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, company_id, inbody_user_id, measured_at, weight_kg, body_fat_kg,
                       body_fat_min_kg, body_fat_max_kg, pbf_pct, ffm_kg, impedance
                FROM public.inbody_measurements
                WHERE company_id = %s::uuid
                ORDER BY inbody_user_id, measured_at
                """,
                (args.company_id,),
            )
            cols = [d[0] for d in cur.description]
            all_rows = [dict(zip(cols, row)) for row in cur.fetchall()]

        by_user: dict[str, list[dict]] = {}
        for row in all_rows:
            by_user.setdefault(row["inbody_user_id"], []).append(row)

        updates: list[tuple] = []
        suspicious = 0
        for group in by_user.values():
            for row in group:
                bfm_min, bfm_max = body_fat_mass_range_kg(
                    float(row["weight_kg"]) if row["weight_kg"] is not None else None,
                    float(row["body_fat_min_kg"]) if row["body_fat_min_kg"] is not None else None,
                    float(row["body_fat_max_kg"]) if row["body_fat_max_kg"] is not None else None,
                )
                row["body_fat_min_kg"] = bfm_min
                row["body_fat_max_kg"] = bfm_max
                dq = build_data_quality(row, group)
                if dq.get("needs_repeat"):
                    suspicious += 1
                updates.append((bfm_min, bfm_max, Json(dq), row["id"]))

        with conn.cursor() as cur:
            cur.executemany(
                """
                UPDATE public.inbody_measurements
                SET body_fat_min_kg = %s,
                    body_fat_max_kg = %s,
                    data_quality = %s,
                    updated_at = now()
                WHERE id = %s::uuid
                """,
                updates,
            )
        conn.commit()
        print(f"Actualizadas {len(updates)} mediciones.")
        print(f"Marcadas como sospechosas (repetir escaneo): {suspicious}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
