#!/usr/bin/env python3
"""
Recalcula composición MorphoScan en inbody_measurements con el motor Suite TBW
(path×sexo → z1×sexo → TBW→FFM→%BF). Misma lógica que src/lib/inbodyLikeBia.ts
(inbody-like-v4-2026-10-fc).

Uso:
  python scripts/backfill_morpho_suite_bia.py --dry-run
  python scripts/backfill_morpho_suite_bia.py
  python scripts/backfill_morpho_suite_bia.py --customer-id <uuid>
  python scripts/backfill_morpho_suite_bia.py --limit 50

Requiere SUPABASE_DB_URL en .env. No toca filas device=inbody.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Any

try:
    import psycopg2
    from psycopg2.extras import Json, RealDictCursor
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
FORMULA = "inbody-like-v4-2026-10-fc"
Z1_SCALE = {"male": 1.33, "female": 1.08}
PATH_SCALE = {"male": 0.73, "female": 0.635}
PATH_Z1_GAMMA = 0.4
HYDRATION = 0.73
PROTEIN_OF_FFM = 0.18
BONE_OF_FFM = 0.07
SMM_OF_FFM = 0.57


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def norm_sex(sex: str | None) -> str:
    s = (sex or "").strip().lower()
    if s in ("f", "female") or s.startswith("mujer") or s == "muller":
        return "female"
    return "male"


def r1(v: float) -> float:
    return round(v * 10) / 10


def r2(v: float) -> float:
    return round(v * 100) / 100


def interpolate_z50(z20: float, z100: float) -> float:
    t = math.log(50 / 20) / math.log(100 / 20)
    return math.exp(math.log(z20) + t * (math.log(z100) - math.log(z20)))


def estimate_path(z20: dict | None, z100: dict | None) -> float | None:
    segs = ("right_arm", "trunk", "right_leg")
    vals: list[float] = []
    for k in segs:
        a = (z20 or {}).get(k)
        b = (z100 or {}).get(k)
        try:
            a = float(a) if a is not None else None
            b = float(b) if b is not None else None
        except (TypeError, ValueError):
            a, b = None, None
        if a and a > 0 and b and b > 0:
            vals.append(interpolate_z50(a, b))
        elif b and b > 0:
            vals.append(b)
        elif a and a > 0:
            vals.append(a)
    if len(vals) < 3:
        return None
    s = sum(vals)
    return r1(s) if 50 < s < 2000 else None


def pick_z1(raw: dict | None, impedance: dict | None) -> float | None:
    raw = raw or {}
    for key in ("impedance_ohm", "z1"):
        v = raw.get(key)
        try:
            n = float(v)
            if 100 <= n <= 1500:
                return n
        except (TypeError, ValueError):
            pass
    return None


def resolve_r(sex: str, z1: float | None, impedance: dict | None) -> tuple[float, str] | None:
    imp = impedance or {}
    z20 = imp.get("20khz") if isinstance(imp.get("20khz"), dict) else None
    z100 = imp.get("100khz") if isinstance(imp.get("100khz"), dict) else None
    z1_r = r1(z1 * Z1_SCALE[sex]) if z1 is not None and 100 <= z1 <= 1500 else None
    path = estimate_path(z20, z100)
    if path is not None:
        path_r = r1(path * PATH_SCALE[sex])
        if z1_r is not None and z1_r > 0:
            if abs(path_r - z1_r) / z1_r > 0.12:
                return z1_r, "z1"
            if path_r < z1_r and PATH_Z1_GAMMA > 0:
                path_r = r1(path_r * (path_r / z1_r) ** PATH_Z1_GAMMA)
        return path_r, "path"
    if z1_r is not None:
        return z1_r, "z1"
    return None


def compute_comp(
    weight: float,
    height: float,
    age: float,
    sex: str,
    r_ohm: float,
) -> dict[str, Any] | None:
    if not (20 <= weight <= 300 and 100 <= height <= 230 and 10 <= age <= 100):
        return None
    if not (150 <= r_ohm <= 1200):
        return None
    s = 1 if sex == "male" else 0
    h2r = (height * height) / r_ohm
    tbw = 0.396 * h2r + 0.156 * weight + 0.046 * age + 4.104 * s - 3.19
    if not (10 < tbw < weight):
        return None
    ffm = tbw / HYDRATION
    if ffm >= weight:
        ffm = weight * 0.96
    if ffm <= weight * 0.4:
        return None
    fat = weight - ffm
    pbf = (fat / weight) * 100
    if not (3 <= pbf <= 55):
        return None
    smm = h2r * 0.401 + s * 3.825 - age * 0.071 + 5.1
    smm_ffm = ffm * SMM_OF_FFM
    if abs(smm - smm_ffm) > 8:
        smm = smm_ffm
    smm = max(ffm * 0.35, min(ffm * 0.7, smm))
    protein = ffm * PROTEIN_OF_FFM
    bone = ffm * BONE_OF_FFM
    muscle = max(0.0, ffm - bone)
    hm = height / 100
    bmi = weight / (hm * hm)
    bmr = round(370 + 21.6 * ffm)
    # LookInBody-like controls (sync idealWeightKg / idealBfmKg)
    if sex == "male":
        ffm_max = max(35.0, min(90.0, -63.16 + 0.7124 * height))
        ideal_w = r1(ffm_max / 0.85)
        ideal_bfm = r2(ideal_w * 0.15)
    else:
        ideal_w = r1(21.5 * hm * hm)
        ideal_bfm = r2(ideal_w * 0.23)
    ideal_ffm = r2(ideal_w - ideal_bfm)
    fat_control = r1(ideal_bfm - fat)
    muscle_control = r1(max(0.0, ideal_ffm - ffm))
    weight_control = r1(ideal_w - weight)
    return {
        "pbf_pct": r1(pbf),
        "body_fat_kg": r2(fat),
        "ffm_kg": r2(ffm),
        "tbw_kg": r2(tbw),
        "smm_kg": r2(smm),
        "slm_kg": r2(muscle),
        "bone_mass_kg": r2(bone),
        "protein_mass_kg": r2(protein),
        "body_water_pct": r1((tbw / weight) * 100),
        "bmi": r1(bmi),
        "bmr_kcal": bmr,
        "smi": r1(smm / (hm * hm)),
        "fat_control_kg": fat_control,
        "muscle_control_kg": muscle_control,
        "weight_control_kg": weight_control,
        "target_weight_kg": ideal_w,
    }


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Backfill Morpho Suite TBW BIA")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--customer-id", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true", help="Reescribe aunque ya tenga suite_bia_formula")
    args = ap.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    sql = """
      SELECT id, weight_kg, height_cm, age_years, sex, impedance, raw_payload,
             pbf_pct, body_fat_kg, ffm_kg, tbw_kg, smm_kg
        FROM public.inbody_measurements
       WHERE device = 'morphoscan'
         AND weight_kg IS NOT NULL
         AND height_cm IS NOT NULL
         AND age_years IS NOT NULL
         AND (
           (impedance IS NOT NULL AND impedance::text <> '{}' AND impedance::text <> 'null')
           OR (raw_payload ? 'impedance_ohm')
           OR (raw_payload ? 'z1')
         )
    """
    params: list[Any] = []
    if args.customer_id:
        sql += " AND customer_id = %s"
        params.append(args.customer_id)
    if not args.force:
        sql += " AND COALESCE(raw_payload->>'suite_bia_formula','') <> %s"
        params.append(FORMULA)
    sql += " ORDER BY measured_at DESC"
    if args.limit and args.limit > 0:
        sql += " LIMIT %s"
        params.append(args.limit)

    cur.execute(sql, params)
    rows = cur.fetchall()
    print(f"Candidatos Morpho: {len(rows)} (formula={FORMULA})")

    updated = 0
    skipped = 0
    for row in rows:
        sex = norm_sex(row.get("sex"))
        try:
            w = float(row["weight_kg"])
            h = float(row["height_cm"])
            age = float(row["age_years"])
        except (TypeError, ValueError):
            skipped += 1
            continue
        imp = row.get("impedance") or {}
        if isinstance(imp, str):
            try:
                imp = json.loads(imp)
            except json.JSONDecodeError:
                imp = {}
        raw = row.get("raw_payload") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                raw = {}
        z1 = pick_z1(raw if isinstance(raw, dict) else None, imp if isinstance(imp, dict) else None)
        resolved = resolve_r(sex, z1, imp if isinstance(imp, dict) else None)
        if not resolved:
            skipped += 1
            continue
        r_ohm, r_src = resolved
        comp = compute_comp(w, h, age, sex, r_ohm)
        if not comp:
            skipped += 1
            continue

        new_raw = dict(raw) if isinstance(raw, dict) else {}
        new_raw.update(
            {
                "suite_bia": True,
                "suite_bia_formula": FORMULA,
                "suite_bia_r_eff_ohm": r_ohm,
                "suite_bia_r_source": r_src,
                "suite_bia_backfill": True,
            }
        )
        delta = abs(float(row["pbf_pct"] or 0) - comp["pbf_pct"])
        print(
            f"  {row['id'][:8]}… pbf {row['pbf_pct']}→{comp['pbf_pct']} "
            f"(Δ{delta:.1f}) R={r_ohm} via {r_src}"
        )
        if args.dry_run:
            updated += 1
            continue

        cur.execute(
            """
            UPDATE public.inbody_measurements SET
              pbf_pct = %s,
              body_fat_kg = %s,
              ffm_kg = %s,
              tbw_kg = %s,
              smm_kg = %s,
              slm_kg = %s,
              bone_mass_kg = COALESCE(%s, bone_mass_kg),
              protein_mass_kg = %s,
              body_water_pct = %s,
              bmi = %s,
              bmr_kcal = %s,
              smi = %s,
              fat_control_kg = %s,
              muscle_control_kg = %s,
              weight_control_kg = %s,
              target_weight_kg = %s,
              raw_payload = %s,
              updated_at = now()
            WHERE id = %s
            """,
            (
                comp["pbf_pct"],
                comp["body_fat_kg"],
                comp["ffm_kg"],
                comp["tbw_kg"],
                comp["smm_kg"],
                comp["slm_kg"],
                comp["bone_mass_kg"],
                comp["protein_mass_kg"],
                comp["body_water_pct"],
                comp["bmi"],
                comp["bmr_kcal"],
                comp["smi"],
                comp["fat_control_kg"],
                comp["muscle_control_kg"],
                comp["weight_control_kg"],
                comp["target_weight_kg"],
                Json(new_raw),
                row["id"],
            ),
        )
        updated += 1

    if args.dry_run:
        conn.rollback()
        print(f"DRY-RUN: {updated} se actualizarían, {skipped} omitidos")
    else:
        conn.commit()
        print(f"Actualizados: {updated}, omitidos: {skipped}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
