#!/usr/bin/env python3
"""Repara TODAS las mediciones MorphoScan/Renpho con la lógica corregida del gateway.

Reglas (igual que renpho-msc04.ts tras el parche):
- Bytes [0:4] tipo xx 11 00 00 = header, NO masa muscular.
- SMM 0x0a00 (25.6 kg) = constante falsa; se ignora.
- Si % grasa del frame >= 10 → usar frame.
- Si frame < 10 → solo peso (nunca inventar grasa/MME desde FFM+header).
- Recalcula pbf, grasa kg, MLG, MME, ACT, limpia slm/proteína falsos.
- Re-deriva segmentales desde impedancia del raw_payload con totales corregidos.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    sys.exit(2)

SEG_KEYS = ("right_arm", "left_arm", "trunk", "right_leg", "left_leg")
LIMB_KEYS = ("right_arm", "left_arm", "right_leg", "left_leg")
LEAN_STD_SHARE = {
    "right_arm": 0.075,
    "left_arm": 0.075,
    "trunk": 0.45,
    "right_leg": 0.20,
    "left_leg": 0.20,
}
FAT_STD_SHARE = {
    "right_arm": 0.08,
    "left_arm": 0.08,
    "trunk": 0.50,
    "right_leg": 0.17,
    "left_leg": 0.17,
}
IDEAL_FAT = {
    "right_arm": 0.08,
    "left_arm": 0.08,
    "trunk": 0.50,
    "right_leg": 0.17,
    "left_leg": 0.17,
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def parse_frame(hexv: str) -> dict[str, Any] | None:
    try:
        data = bytes.fromhex(hexv)
    except ValueError:
        return None
    if len(data) < 8 or data[0] != 0x55 or data[1] != 0xAA:
        return None
    cmd = data[2]
    plen = int.from_bytes(data[3:5], "big")
    if plen < 32 or len(data) < 5 + plen:
        return None
    payload = data[5 : 5 + plen]
    weight = int.from_bytes(payload[plen - 32 : plen - 30], "big") / 100
    frame_fat = int.from_bytes(payload[plen - 8 : plen - 6], "big") / 10
    if not (0.5 <= weight <= 300) or not (0 <= frame_fat <= 60):
        return None

    header = len(payload) >= 4 and payload[1] == 0x11 and payload[2] == 0x00 and payload[3] == 0x00
    mus = int.from_bytes(payload[0:2], "little") / 100 if len(payload) >= 2 else None
    bone = None
    if len(payload) >= 17:
        bone_raw = int.from_bytes(payload[15:17], "big") / 1000
        if 1.5 <= bone_raw <= 6:
            bone = bone_raw

    smm = None
    if len(payload) >= 8:
        smm_raw = int.from_bytes(payload[6:8], "big")
        if smm_raw != 0x0A00:
            smm_val = smm_raw / 100
            if 10 <= smm_val <= 60:
                smm = smm_val

    return {
        "cmd": cmd,
        "weight": weight,
        "frame_fat": frame_fat,
        "header_muscle": header,
        "muscle": mus if mus and 15 <= mus <= 90 else None,
        "bone": bone,
        "smm_trusted": smm,
    }


def recompute(
    frame: dict[str, Any],
    sex: str | None,
    bone_fallback: float | None = None,
) -> dict[str, Any]:
    w = float(frame["weight"])
    frame_fat = float(frame["frame_fat"])
    bone = frame.get("bone")
    if bone is None and bone_fallback is not None and 1.5 <= float(bone_fallback) <= 6:
        bone = float(bone_fallback)
    muscle = frame.get("muscle")
    header = bool(frame.get("header_muscle"))

    pbf: float | None = frame_fat
    fat_source = "frame"
    # Solo confiar en % grasa del frame >= 10. Nunca inventar desde FFM/header.
    if frame_fat < 10:
        return {
            "pbf_pct": None,
            "body_fat_kg": None,
            "ffm_kg": None,
            "smm_kg": None,
            "tbw_kg": None,
            "body_water_pct": None,
            "slm_kg": None,
            "bone_mass_kg": round(float(bone), 2) if bone is not None else None,
            "protein_mass_kg": None,
            "protein_pct": None,
            "fat_source": "weight_only",
            "header_muscle": header,
        }

    pbf = round(float(pbf), 1)
    fat_kg = round(w * pbf / 100, 2)
    ffm = round(w - fat_kg, 2)
    smm = frame.get("smm_trusted")
    if smm is None:
        smm = round(ffm * 0.54, 2)
    else:
        smm = round(float(smm), 2)
    tbw = round(ffm * 0.73, 2)
    body_water_pct = round((tbw / w) * 100, 1) if w else None
    slm = None if header else (round(float(muscle), 2) if muscle else None)
    protein = round(ffm * 0.20, 2)
    protein_pct = round((protein / w) * 100, 1) if w else None

    return {
        "pbf_pct": pbf,
        "body_fat_kg": fat_kg,
        "ffm_kg": ffm,
        "smm_kg": smm,
        "tbw_kg": tbw,
        "body_water_pct": body_water_pct,
        "slm_kg": slm,
        "bone_mass_kg": round(float(bone), 2) if bone is not None else None,
        "protein_mass_kg": protein,
        "protein_pct": protein_pct,
        "fat_source": fat_source,
        "header_muscle": header,
    }


def std_lean_total(sex: str | None, height_cm: float | None) -> float | None:
    if height_cm is None or height_cm <= 0:
        return None
    s = (sex or "").upper()
    # Aprox. estilo InBody / MorphoScan
    if s.startswith("F") or s in ("MUJER", "WOMAN", "FEMALE"):
        return round(height_cm * 0.28, 2)
    return round(height_cm * 0.32, 2)


def std_fat_total(sex: str | None, height_cm: float | None) -> float | None:
    if height_cm is None or height_cm <= 0:
        return None
    s = (sex or "").upper()
    if s.startswith("F") or s in ("MUJER", "WOMAN", "FEMALE"):
        return round(height_cm * 0.12, 2)
    return round(height_cm * 0.09, 2)


def derive_segmentals(
    impedance: dict[str, Any] | None,
    lean_total: float,
    fat_total: float,
    sex: str | None,
    height_cm: float | None,
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    if not impedance or not isinstance(impedance, dict):
        return None
    z20 = impedance.get("20khz") or impedance.get("20kHz")
    if not isinstance(z20, dict):
        return None
    if lean_total < 10:
        return None

    limb_g: dict[str, float] = {}
    sum_g = 0.0
    for k in LIMB_KEYS:
        ohm = float(z20.get(k) or 0)
        if ohm > 0:
            limb_g[k] = 1.0 / ohm
            sum_g += limb_g[k]
    if sum_g <= 0:
        return None

    limb_target = lean_total * 0.52
    lean_kg = {k: 0.0 for k in SEG_KEYS}
    for k in LIMB_KEYS:
        lean_kg[k] = (limb_target * limb_g[k]) / sum_g if k in limb_g else limb_target / 4
    lean_kg["trunk"] = max(0.0, lean_total - sum(lean_kg[k] for k in LIMB_KEYS))

    fat_kg = {k: 0.0 for k in SEG_KEYS}
    if fat_total > 0:
        w = dict(IDEAL_FAT)
        sum_w = 0.0
        for k in LIMB_KEYS:
            ohm = float(z20.get(k) or 0)
            if ohm > 0:
                w[k] = IDEAL_FAT[k] * (ohm / 300)
            sum_w += w[k]
        sum_w += w["trunk"]
        for k in SEG_KEYS:
            fat_kg[k] = (fat_total * w[k]) / sum_w

    lean_std_tot = std_lean_total(sex, height_cm)
    fat_std_tot = std_fat_total(sex, height_cm)
    lean_out: dict[str, Any] = {
        "diff_arm": round(abs(lean_kg["right_arm"] - lean_kg["left_arm"]), 2),
        "diff_leg": round(abs(lean_kg["right_leg"] - lean_kg["left_leg"]), 2),
    }
    fat_out: dict[str, Any] = {}
    for k in SEG_KEYS:
        lean_std = lean_std_tot * LEAN_STD_SHARE[k] if lean_std_tot else None
        fat_std = fat_std_tot * FAT_STD_SHARE[k] if fat_std_tot else None
        lean_pct = round(1000 * lean_kg[k] / lean_std) / 10 if lean_std and lean_std > 0 else None
        fat_pct = round(1000 * fat_kg[k] / fat_std) / 10 if fat_std and fat_std > 0 else None
        lean_out[k] = {
            "kg": round(lean_kg[k], 2),
            "eval_pct": lean_pct,
            "pct": lean_pct,
            "standard_kg": round(lean_std, 2) if lean_std is not None else None,
        }
        fat_out[k] = {
            "kg": round(fat_kg[k], 2),
            "pct": fat_pct,
            "eval_pct": fat_pct,
            "standard_kg": round(fat_std, 2) if fat_std is not None else None,
        }
    return lean_out, fat_out


def needs_update(row: dict[str, Any], vals: dict[str, Any]) -> bool:
    checks = (
        ("pbf_pct", 0.15),
        ("body_fat_kg", 0.15),
        ("ffm_kg", 0.15),
        ("smm_kg", 0.15),
        ("tbw_kg", 0.15),
    )
    for key, tol in checks:
        old = row.get(key)
        new = vals.get(key)
        if new is None:
            continue
        if old is None or abs(float(old) - float(new)) > tol:
            return True
    # slm falso ~43.5
    slm = row.get("slm_kg")
    if slm is not None and 43.4 <= float(slm) <= 43.7:
        return True
    if row.get("smm_kg") is not None and abs(float(row["smm_kg"]) - 25.6) < 0.05:
        return True
    if (row.get("fat_source") or "") != vals["fat_source"] and vals["fat_source"] == "frame":
        # already from_ffm with correct numbers still refresh source tag if we now prefer frame
        pass
    return False


def main() -> int:
    apply = "--apply" in sys.argv
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        load_dotenv(Path(".env"))
        db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("Falta DATABASE_URL / SUPABASE_DB_URL", file=sys.stderr)
        return 2

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT id, measured_at, weight_kg, smm_kg, body_fat_kg, pbf_pct, ffm_kg, tbw_kg,
               slm_kg, bone_mass_kg, protein_mass_kg, protein_pct, body_water_pct,
               sex, height_cm, segmental_lean, segmental_fat, raw_payload,
               raw_payload->>'body_comp_hex' AS hex,
               raw_payload->>'fat_source' AS fat_source
        FROM public.inbody_measurements
        WHERE device = 'morphoscan'
        ORDER BY measured_at DESC
        """
    )
    rows = cur.fetchall()
    updated = 0
    skipped = 0
    for row in rows:
        hexv = row.get("hex")
        if not hexv:
            # Sin hex: solo limpiar constantes obvias si pbf ya parece usable
            w = float(row["weight_kg"] or 0)
            pbf = float(row["pbf_pct"]) if row["pbf_pct"] is not None else None
            if w <= 0 or pbf is None or pbf < 3 or pbf > 55:
                skipped += 1
                print(f"SKIP no-hex {row['id']} w={row['weight_kg']} pbf={row['pbf_pct']}")
                continue
            fat_kg = round(w * pbf / 100, 2)
            ffm = round(w - fat_kg, 2)
            smm = round(ffm * 0.54, 2)
            tbw = round(ffm * 0.73, 2)
            vals = {
                "pbf_pct": round(pbf, 1),
                "body_fat_kg": fat_kg,
                "ffm_kg": ffm,
                "smm_kg": smm,
                "tbw_kg": tbw,
                "body_water_pct": round((tbw / w) * 100, 1),
                "slm_kg": None,
                "protein_mass_kg": round(ffm * 0.20, 2),
                "protein_pct": round((ffm * 0.20 / w) * 100, 1),
                "bone_mass_kg": row.get("bone_mass_kg"),
                "fat_source": "recomputed_no_hex",
                "header_muscle": True,
            }
            frame = None
        else:
            frame = parse_frame(hexv)
            if not frame:
                skipped += 1
                print(f"SKIP bad-hex {row['id']}")
                continue
            vals = recompute(
                frame,
                row.get("sex"),
                bone_fallback=float(row["bone_mass_kg"]) if row.get("bone_mass_kg") is not None else None,
            )

        would = needs_update(row, vals)
        slm = row.get("slm_kg")
        fake_slm = slm is not None and 43.4 <= float(slm) <= 43.7
        fake_smm = row.get("smm_kg") is not None and abs(float(row["smm_kg"]) - 25.6) < 0.05
        already = (row.get("fat_source") or "") in (
            "frame_repaired",
            "from_ffm_repaired",
            "full_repaired",
            "recomputed_no_hex",
        )
        # Forzar recálculo completo en todos (incl. ya reparados parcialmente) para
        # alinear segmentales / proteína / ACT con la misma fórmula.
        force_all = True
        if not would and not fake_slm and not fake_smm and already and not force_all:
            skipped += 1
            continue

        raw = row.get("raw_payload") or {}
        if isinstance(raw, str):
            raw = json.loads(raw)
        impedance = raw.get("impedance") if isinstance(raw, dict) else None
        segs = None
        if vals.get("ffm_kg") is not None and vals.get("body_fat_kg") is not None:
            segs = derive_segmentals(
                impedance if isinstance(impedance, dict) else None,
                float(vals["ffm_kg"]),
                float(vals["body_fat_kg"]),
                row.get("sex"),
                float(row["height_cm"]) if row.get("height_cm") else None,
            )

        w_show = frame["weight"] if frame else row["weight_kg"]
        print(
            f"{row['id']} w={w_show} "
            f"pbf {row['pbf_pct']}→{vals['pbf_pct']} "
            f"fat {row['body_fat_kg']}→{vals['body_fat_kg']} "
            f"smm {row['smm_kg']}→{vals['smm_kg']} "
            f"ffm {row['ffm_kg']}→{vals['ffm_kg']} "
            f"[{vals['fat_source']}] segs={'yes' if segs else 'no'}"
        )

        if apply:
            if vals["fat_source"] == "frame":
                fat_tag = "frame_repaired"
            elif vals["fat_source"] == "from_ffm":
                fat_tag = "from_ffm_repaired"
            elif vals["fat_source"] == "weight_only":
                fat_tag = "weight_only"
            else:
                fat_tag = vals["fat_source"]
            patch = {
                "fat_source": fat_tag,
                "repair_note": "Reparación completa MorphoScan: header músculo/SMM rechazados; composición recalculada",
                "repair_version": 2,
            }

            # Segmentales: si weight_only, vaciar los derivados del músculo falso.
            seg_lean = json.dumps(segs[0]) if segs else (json.dumps({}) if vals["fat_source"] == "weight_only" else None)
            seg_fat = json.dumps(segs[1]) if segs else (json.dumps({}) if vals["fat_source"] == "weight_only" else None)

            cur.execute(
                """
                UPDATE public.inbody_measurements
                SET pbf_pct = %(pbf_pct)s,
                    body_fat_kg = %(body_fat_kg)s,
                    ffm_kg = %(ffm_kg)s,
                    smm_kg = %(smm_kg)s,
                    tbw_kg = %(tbw_kg)s,
                    body_water_pct = %(body_water_pct)s,
                    slm_kg = %(slm_kg)s,
                    bone_mass_kg = COALESCE(%(bone_mass_kg)s, bone_mass_kg),
                    protein_mass_kg = %(protein_mass_kg)s,
                    protein_pct = %(protein_pct)s,
                    segmental_lean = COALESCE(%(segmental_lean)s::jsonb, segmental_lean),
                    segmental_fat = COALESCE(%(segmental_fat)s::jsonb, segmental_fat),
                    raw_payload = coalesce(raw_payload, '{}'::jsonb) || %(patch)s::jsonb,
                    updated_at = now()
                WHERE id = %(id)s
                """,
                {
                    "pbf_pct": vals["pbf_pct"],
                    "body_fat_kg": vals["body_fat_kg"],
                    "ffm_kg": vals["ffm_kg"],
                    "smm_kg": vals["smm_kg"],
                    "tbw_kg": vals["tbw_kg"],
                    "body_water_pct": vals["body_water_pct"],
                    "slm_kg": vals["slm_kg"],
                    "bone_mass_kg": vals["bone_mass_kg"],
                    "protein_mass_kg": vals["protein_mass_kg"],
                    "protein_pct": vals["protein_pct"],
                    "segmental_lean": seg_lean,
                    "segmental_fat": seg_fat,
                    "patch": json.dumps(patch),
                    "id": row["id"],
                },
            )
        updated += 1

    if apply:
        conn.commit()
        print(f"APPLY ok: {updated} actualizadas, {skipped} skip")
    else:
        conn.rollback()
        print(f"DRY-RUN: {updated} se actualizarían, {skipped} skip — pasa --apply")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
