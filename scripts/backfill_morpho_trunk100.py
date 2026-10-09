#!/usr/bin/env python3
"""
Recalcula impedance MorphoScan desde body_comp_hex con tronco @100 kHz = BE[17]
(antes LE[16] solapaba bone y provocaba missing_100khz_segment).

También:
  - reescribe data_quality (alineado con scale-ingest)
  - recalcula composición Suite TBW si hay perfil (misma lógica que backfill_morpho_suite_bia.py)

Uso:
  python scripts/backfill_morpho_trunk100.py --dry-run
  python scripts/backfill_morpho_trunk100.py
  python scripts/backfill_morpho_trunk100.py --limit 20
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone
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
BACKFILL_TAG = "trunk100-be17-2026-10"
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


def parse_frame_hex(hx: str) -> dict[str, Any] | None:
    """Decode 0x25/0x26 Morpho frame → impedance map + z1/z2/bone (BE[17] trunk@100)."""
    try:
        raw = bytes.fromhex(hx.replace(" ", "").replace(":", "").lower())
    except ValueError:
        return None
    if len(raw) < 8 or raw[0] != 0x55 or raw[1] != 0xAA:
        return None
    cmd = raw[2]
    if cmd not in (0x25, 0x26):
        return None
    plen = (raw[3] << 8) | raw[4]
    if plen < 32 or len(raw) < 5 + plen + 1:
        return None
    payload = raw[5 : 5 + plen]
    base = 0

    def be_u16(i: int) -> int:
        return (payload[i] << 8) | payload[i + 1]

    def le_u16(i: int) -> int:
        return payload[i] | (payload[i + 1] << 8)

    def be10(i: int) -> float:
        return be_u16(i) / 10

    def le10(i: int) -> float:
        return le_u16(i) / 10

    out: dict[str, Any] = {"cmd": cmd, "plen": plen}
    if len(payload) >= base + 12:
        z1 = le_u16(base + 8) / 10
        z2 = le_u16(base + 10) / 10
        if 100 <= z1 <= 1500:
            out["z1"] = z1
        if 100 <= z2 <= 1500:
            out["z2"] = z2
    if len(payload) >= base + 17:
        bone = be_u16(base + 15) / 1000
        if 1.5 <= bone <= 6:
            out["bone_kg"] = r2(bone)

    if len(payload) < base + 26:
        return out

    z20: dict[str, float] = {}
    z100: dict[str, float] = {}
    t20, la20, ra20, rl20, ll20 = be10(7), be10(9), be10(11), be10(13), le10(12)
    if 10 <= t20 <= 80:
        z20["trunk"] = r1(t20)
    if 200 <= la20 <= 600:
        z20["left_arm"] = r1(la20)
    if 200 <= ra20 <= 600:
        z20["right_arm"] = r1(ra20)
    if 200 <= rl20 <= 500:
        z20["right_leg"] = r1(rl20)
    if 200 <= ll20 <= 500:
        z20["left_leg"] = r1(ll20)

    la100, ra100, leg100 = be10(19), be10(21), be10(23)
    # FIX: trunk@100 = BE[17], not LE[16] (bone overlap)
    t100 = be10(17)
    if 200 <= la100 <= 600:
        z100["left_arm"] = r1(la100)
    if 200 <= ra100 <= 600:
        z100["right_arm"] = r1(ra100)
    if 200 <= leg100 <= 500:
        z100["right_leg"] = r1(leg100)
        z100["left_leg"] = r1(leg100)
    if 10 <= t100 <= 80:
        z100["trunk"] = r1(t100)

    if len(z20) >= 3 or len(z100) >= 2:
        out["impedance"] = {"20khz": z20, "100khz": z100}
    return out


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


def assess_quality(
    *,
    weight: float | None,
    pbf: float | None,
    body_fat_kg: float | None,
    raw: dict,
    impedance: dict | None,
    sex: str | None,
) -> dict[str, Any]:
    fat_source = str(raw.get("fat_source") or "")
    weight_only = (
        raw.get("weight_only") is True
        or fat_source in ("none", "from_ffm")
        or (pbf is None and body_fat_kg is None)
    )
    issues: list[str] = []
    if weight_only:
        issues.extend(["weight_only", "missing_core_fields"])
    if pbf is None and body_fat_kg is None:
        issues.append("no_composition")

    z1 = None
    for key in ("impedance_ohm", "z1"):
        try:
            n = float(raw[key])
            if n >= 100:
                z1 = n
                break
        except (KeyError, TypeError, ValueError):
            pass
    if z1 is None or z1 < 100:
        issues.append("no_z1")

    z20 = (impedance or {}).get("20khz") if isinstance((impedance or {}).get("20khz"), dict) else None
    z100 = (impedance or {}).get("100khz") if isinstance((impedance or {}).get("100khz"), dict) else None
    segs = ("right_arm", "trunk", "right_leg")
    path_segs = 0
    path_sum = 0.0
    if z20:
        for k in segs:
            a = z20.get(k)
            b = (z100 or {}).get(k) if z100 else None
            try:
                a = float(a) if a is not None else None
                b = float(b) if b is not None else None
            except (TypeError, ValueError):
                a, b = None, None
            if a and a > 0 and b and b > 0:
                path_segs += 1
                path_sum += interpolate_z50(a, b)
                # Morpho reales ≈ 12–15 Ω @100 kHz; <10 Ω = basura/misparse.
                if k == "trunk" and b < 10:
                    issues.append("trunk100_suspect")
            elif b and b > 0:
                path_segs += 1
                path_sum += b
            elif a and a > 0:
                path_segs += 1
                path_sum += a
                issues.append("missing_100khz_segment")
    dual_ok = dual_freq_complete(z20, z100)
    if path_segs < 3:
        issues.extend(["path_incomplete", "no_path"])
    elif z1 is not None and z1 >= 100:
        female = norm_sex(sex) == "female"
        path_r = path_sum * (0.635 if female else 0.73)
        z1_r = z1 * (1.08 if female else 1.33)
        rel = abs(path_r - z1_r) / z1_r if z1_r > 0 else 0
        if rel > 0.12:
            issues.append("path_z1_warn" if dual_ok else "path_z1_discord")
        elif rel > 0.08:
            issues.append("path_z1_warn")

    if pbf is not None and pbf < 8 and (weight or 0) >= 40:
        issues.append("pbf_too_low")

    unique = list(dict.fromkeys(issues))
    bad_keys = {
        "weight_only",
        "missing_core_fields",
        "no_composition",
        "no_z1",
        "no_path",
        "path_incomplete",
        "path_z1_discord",
    }
    warn_keys = {"trunk100_suspect", "missing_100khz_segment", "path_z1_warn", "pbf_too_low"}
    is_bad = any(i in bad_keys for i in unique)
    is_warn = (not is_bad) and any(i in warn_keys for i in unique)
    grade = "bad" if is_bad else "warn" if is_warn else "good"
    needs = grade != "good"
    return {
        "status": "suspicious" if needs else "ok",
        "needs_repeat": needs,
        "morpho_grade": grade,
        "issues": unique,
        "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "hint": (
            {
                "source": "morphoscan_frame",
                "message": (
                    "Composición no fiable (impedancia incompleta o path inválido). Repite la medición."
                    if is_bad
                    else "Toma poco fiable (contacto irregular). Conviene repetir la medición."
                ),
            }
            if needs
            else None
        ),
        "backfill": BACKFILL_TAG,
    }


def dual_freq_complete(z20: dict | None, z100: dict | None) -> bool:
    """True si RA+tronco+RL tienen ambos 20 y 100 kHz (path fiable)."""
    if not z20 or not z100:
        return False
    for k in ("right_arm", "trunk", "right_leg"):
        try:
            a = float(z20.get(k) or 0)
            b = float(z100.get(k) or 0)
        except (TypeError, ValueError):
            return False
        if not (a > 0 and b > 0):
            return False
    return True


def resolve_r(sex: str, z1: float | None, impedance: dict | None) -> tuple[float, str] | None:
    imp = impedance or {}
    z20 = imp.get("20khz") if isinstance(imp.get("20khz"), dict) else None
    z100 = imp.get("100khz") if isinstance(imp.get("100khz"), dict) else None
    z1_r = r1(z1 * Z1_SCALE[sex]) if z1 is not None and 100 <= z1 <= 1500 else None
    path = estimate_path(z20, z100)
    if path is not None:
        path_r = r1(path * PATH_SCALE[sex])
        complete = dual_freq_complete(z20, z100)
        if z1_r is not None and z1_r > 0:
            rel = abs(path_r - z1_r) / z1_r
            # Con mapa dual-freq completo preferir path (tronco@100 real suele
            # bajar path respecto a z1; no saltar a z1 por el umbral 12 %).
            if rel > 0.12 and not complete:
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
    if sex == "male":
        ffm_max = max(35.0, min(90.0, -63.16 + 0.7124 * height))
        ideal_w = r1(ffm_max / 0.85)
        ideal_bfm = r2(ideal_w * 0.15)
    else:
        ideal_w = r1(21.5 * hm * hm)
        ideal_bfm = r2(ideal_w * 0.23)
    ideal_ffm = r2(ideal_w - ideal_bfm)
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
        "fat_control_kg": r1(ideal_bfm - fat),
        "muscle_control_kg": r1(max(0.0, ideal_ffm - ffm)),
        "weight_control_kg": r1(ideal_w - weight),
        "target_weight_kg": ideal_w,
    }


def impedance_changed(old: Any, new: dict) -> bool:
    if not isinstance(old, dict):
        return True
    return json.dumps(old, sort_keys=True) != json.dumps(new, sort_keys=True)


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Backfill Morpho trunk@100 from hex")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true", help="Reescribe aunque ya tenga el tag de backfill")
    args = ap.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    sql = """
      SELECT id, measured_at, weight_kg, height_cm, age_years, sex,
             impedance, raw_payload, data_quality,
             pbf_pct, body_fat_kg, ffm_kg, tbw_kg, smm_kg
        FROM public.inbody_measurements
       WHERE device = 'morphoscan'
         AND raw_payload ? 'body_comp_hex'
         AND length(coalesce(raw_payload->>'body_comp_hex','')) > 40
    """
    params: list[Any] = []
    if not args.force:
        sql += " AND coalesce(raw_payload->>'suite_trunk100_backfill','') <> %s"
        params.append(BACKFILL_TAG)
    sql += " ORDER BY measured_at DESC"
    if args.limit and args.limit > 0:
        sql += " LIMIT %s"
        params.append(args.limit)

    cur.execute(sql, params)
    rows = cur.fetchall()
    print(f"Candidatos con hex: {len(rows)} (tag={BACKFILL_TAG})")

    updated = 0
    skipped = 0
    fixed_trunk = 0
    grade_counts: dict[str, int] = {}

    for row in rows:
        raw = row.get("raw_payload") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                raw = {}
        if not isinstance(raw, dict):
            skipped += 1
            continue
        hx = str(raw.get("body_comp_hex") or "")
        parsed = parse_frame_hex(hx)
        if not parsed or "impedance" not in parsed:
            skipped += 1
            continue

        new_imp = parsed["impedance"]
        old_imp = row.get("impedance") or {}
        if isinstance(old_imp, str):
            try:
                old_imp = json.loads(old_imp)
            except json.JSONDecodeError:
                old_imp = {}

        old_t100 = None
        if isinstance(old_imp, dict) and isinstance(old_imp.get("100khz"), dict):
            old_t100 = old_imp["100khz"].get("trunk")
        new_t100 = new_imp.get("100khz", {}).get("trunk")
        if new_t100 is not None and old_t100 != new_t100:
            fixed_trunk += 1

        new_raw = dict(raw)
        new_raw["impedance"] = new_imp
        if parsed.get("z1") is not None:
            new_raw["impedance_ohm"] = parsed["z1"]
        if parsed.get("z2") is not None:
            new_raw["impedance_ohm_2"] = parsed["z2"]
        new_raw["suite_trunk100_backfill"] = BACKFILL_TAG
        new_raw["suite_trunk100_offset"] = "be17"

        # Recompute BIA when profile present and not weight-only
        sex = norm_sex(row.get("sex"))
        z1 = parsed.get("z1")
        if z1 is None:
            try:
                z1 = float(new_raw.get("impedance_ohm"))
            except (TypeError, ValueError):
                z1 = None

        comp = None
        pbf = row.get("pbf_pct")
        body_fat_kg = row.get("body_fat_kg")
        fat_source = str(new_raw.get("fat_source") or "")
        weight_only = new_raw.get("weight_only") is True or fat_source in ("none", "from_ffm")

        if (
            not weight_only
            and row.get("weight_kg")
            and row.get("height_cm")
            and row.get("age_years")
        ):
            resolved = resolve_r(sex, z1, new_imp)
            if resolved:
                r_ohm, r_src = resolved
                try:
                    comp = compute_comp(
                        float(row["weight_kg"]),
                        float(row["height_cm"]),
                        float(row["age_years"]),
                        sex,
                        r_ohm,
                    )
                except (TypeError, ValueError):
                    comp = None
                if comp:
                    pbf = comp["pbf_pct"]
                    body_fat_kg = comp["body_fat_kg"]
                    new_raw.update(
                        {
                            "suite_bia": True,
                            "suite_bia_formula": FORMULA,
                            "suite_bia_r_eff_ohm": r_ohm,
                            "suite_bia_r_source": r_src,
                            "suite_bia_backfill": True,
                            "fat_source": "from_bia",
                        }
                    )
                    new_raw.pop("weight_only", None)

        try:
            w = float(row["weight_kg"]) if row.get("weight_kg") is not None else None
        except (TypeError, ValueError):
            w = None
        try:
            pbf_f = float(pbf) if pbf is not None else None
        except (TypeError, ValueError):
            pbf_f = None
        try:
            fat_f = float(body_fat_kg) if body_fat_kg is not None else None
        except (TypeError, ValueError):
            fat_f = None

        dq = assess_quality(
            weight=w,
            pbf=pbf_f,
            body_fat_kg=fat_f,
            raw=new_raw,
            impedance=new_imp,
            sex=row.get("sex"),
        )
        grade_counts[dq["morpho_grade"]] = grade_counts.get(dq["morpho_grade"], 0) + 1

        changed = impedance_changed(old_imp, new_imp) or comp is not None
        print(
            f"  {str(row['id'])[:8]}… t100 {old_t100}→{new_t100} "
            f"grade={dq['morpho_grade']} issues={dq['issues']}"
            + (f" pbf→{comp['pbf_pct']}" if comp else "")
        )

        if args.dry_run:
            if changed or True:
                updated += 1
            continue

        if comp:
            cur.execute(
                """
                UPDATE public.inbody_measurements SET
                  impedance = %s,
                  data_quality = %s,
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
                    Json(new_imp),
                    Json(dq),
                    comp["pbf_pct"],
                    comp["body_fat_kg"],
                    comp["ffm_kg"],
                    comp["tbw_kg"],
                    comp["smm_kg"],
                    comp["slm_kg"],
                    comp.get("bone_mass_kg") or parsed.get("bone_kg"),
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
        else:
            cur.execute(
                """
                UPDATE public.inbody_measurements SET
                  impedance = %s,
                  data_quality = %s,
                  raw_payload = %s,
                  updated_at = now()
                WHERE id = %s
                """,
                (Json(new_imp), Json(dq), Json(new_raw), row["id"]),
            )
        updated += 1

    if args.dry_run:
        conn.rollback()
        print(
            f"DRY-RUN: {updated} se actualizarían, {skipped} omitidos, "
            f"trunk corregido≈{fixed_trunk}, grades={grade_counts}"
        )
    else:
        conn.commit()
        print(
            f"Actualizados: {updated}, omitidos: {skipped}, "
            f"trunk corregido≈{fixed_trunk}, grades={grade_counts}"
        )
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
