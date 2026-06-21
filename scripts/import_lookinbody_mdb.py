"""
Importa mediciones InBody desde LookinBody30.mdb → public.inbody_measurements.

Tablas MDB usadas (join por índice / DATETIMES):
  BCA_TBL, MFA_TBL, LB_TBL, IMP_TBL, WC_TBL, ED_TBL, USER_INFO1_TBL

Vinculación cliente: inbody_user_id ↔ customers.tax_id (DNI normalizado).

Requisitos:
  pip install access-parser psycopg2-binary
  SUPABASE_DB_URL en .env

Uso:
  python scripts/import_lookinbody_mdb.py
  python scripts/import_lookinbody_mdb.py --mdb "Z:\\Users\\Lipoout\\Lookin'BodyBasic\\Database\\LookinBody30.mdb"
  python scripts/import_lookinbody_mdb.py --dry-run
  python scripts/import_lookinbody_mdb.py --replace-batch  # borra batch previo antes de insertar
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

try:
    import psycopg2
    from psycopg2.extras import Json, execute_batch
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

try:
    from access_parser import AccessParser
except ImportError:
    print("pip install access-parser", file=sys.stderr)
    raise

from legacy_company import get_company_id

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inbody_quality import body_fat_mass_range_kg, build_data_quality

ROOT = Path(__file__).resolve().parents[1]
MADRID = ZoneInfo("Europe/Madrid")
DEFAULT_MDB = r"Z:\Users\Lipoout\Lookin'BodyBasic\Database\LookinBody30.mdb"
IMPORT_BATCH = "lookinbody_mdb_initial"


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


def norm_tax_id(value: object) -> str | None:
    s = re.sub(r"[\s\-\.]", "", str(value or "")).upper()
    return s if s else None


def norm_inbody_user_id(value: object) -> str:
    return re.sub(r"[\s\-\.]", "", str(value or "")).strip().upper()


def dni_numeric_key(value: object) -> str | None:
    s = norm_tax_id(value)
    if not s:
        return None
    m = re.match(r"^(\d{7,8})([A-Z])?$", s)
    if m:
        return m.group(1).zfill(8)
    m = re.match(r"^([XYZ]\d{7})([A-Z])?$", s)
    if m:
        return m.group(1)
    if re.match(r"^[A-Z0-9]+$", s) and re.search(r"\d", s) and s[-1].isalpha():
        without = s[:-1]
        if re.match(r"^\d{7,8}$", without):
            return without.zfill(8)
        return without
    return s


def dni_match_keys(value: object) -> list[str]:
    raw = re.sub(r"[\s\-\.]", "", str(value or ""))
    s = raw.upper()
    if not s:
        return []
    keys = {s, raw}
    numeric = dni_numeric_key(s)
    if numeric:
        keys.add(numeric)
        stripped = numeric.lstrip("0") or "0"
        keys.add(stripped)
        keys.add(stripped.zfill(8))
    return list(keys)


def find_customer_id(user_id: object, customer_by_tax: dict[str, str]) -> str | None:
    for key in dni_match_keys(user_id):
        cid = customer_by_tax.get(key)
        if cid:
            return cid
    return None


def to_float(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value != value:
            return None
        return float(value)
    s = str(value).strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_measured_at(raw: object) -> datetime | None:
    s = str(raw or "").strip()
    if len(s) != 14 or not s.isdigit():
        return None
    try:
        return datetime.strptime(s, "%Y%m%d%H%M%S").replace(tzinfo=MADRID)
    except ValueError:
        return None


def table_dict(db: AccessParser, name: str) -> dict[str, list[Any]]:
    parsed = db.parse_table(name)
    if isinstance(parsed, dict):
        return parsed
    return {c: parsed[c].tolist() for c in parsed.columns}


def row_dict(data: dict[str, list[Any]], idx: int) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, col in data.items():
        if idx < len(col):
            v = col[idx]
            if isinstance(v, float) and v != v:
                v = None
            out[k] = v
    return out


def json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        if value != value:
            return None
        return round(value, 6) if abs(value) < 1e6 else round(value, 3)
    if isinstance(value, (int, str, bool)):
        return value
    return str(value)


def compact_json(row: dict[str, Any]) -> dict[str, Any]:
    return {k: json_safe(v) for k, v in row.items() if v is not None}


def finalize_row_quality(dict_rows: list[dict[str, Any]]) -> int:
    by_user: dict[str, list[dict[str, Any]]] = {}
    for row in dict_rows:
        by_user.setdefault(row["inbody_user_id"], []).append(row)
    suspicious = 0
    for group in by_user.values():
        for row in group:
            dq = build_data_quality(row, group)
            row["data_quality"] = dq
            if dq.get("needs_repeat"):
                suspicious += 1
    return suspicious


def row_to_insert_tuple(row: dict[str, Any]) -> tuple:
    return (
        row["id"],
        row["company_id"],
        row["customer_id"],
        row["inbody_user_id"],
        row["measured_at"],
        row["height_cm"],
        row["age_years"],
        row["sex"],
        row["weight_kg"],
        row["weight_min_kg"],
        row["weight_max_kg"],
        row["smm_kg"],
        row["smm_min_kg"],
        row["smm_max_kg"],
        row["body_fat_kg"],
        row["body_fat_min_kg"],
        row["body_fat_max_kg"],
        row["tbw_kg"],
        row["tbw_min_kg"],
        row["tbw_max_kg"],
        row["ffm_kg"],
        row["ffm_min_kg"],
        row["ffm_max_kg"],
        row["slm_kg"],
        row["bmi"],
        row["bmi_min"],
        row["bmi_max"],
        row["pbf_pct"],
        row["pbf_min_pct"],
        row["pbf_max_pct"],
        row["whr"],
        row["whr_min"],
        row["whr_max"],
        row["bmr_kcal"],
        row["bmr_min_kcal"],
        row["bmr_max_kcal"],
        row["fat_control_kg"],
        row["muscle_control_kg"],
        Json(row["segmental_lean"]),
        Json(row["segmental_fat"]),
        Json(row["impedance"]),
        Json(row["edema"]),
        Json(row["bca"]),
        Json(row["mfa"]),
        Json(row["lb"]),
        Json(row["wc"]),
        Json(row["imp"]),
        Json(row["ed"]),
        Json(row["data_quality"]),
        row["source"],
        row["import_batch"],
    )


def segmental_lean(lb: dict[str, Any]) -> dict[str, Any]:
    return {
        "right_arm": {
            "kg": json_safe(lb.get("LRA")),
            "pct": json_safe(lb.get("PLRA")),
            "eval_pct": json_safe(lb.get("PILRA")),
        },
        "left_arm": {
            "kg": json_safe(lb.get("LLA")),
            "pct": json_safe(lb.get("PLLA")),
            "eval_pct": json_safe(lb.get("PILLA")),
        },
        "trunk": {
            "kg": json_safe(lb.get("LT")),
            "pct": json_safe(lb.get("PLT")),
            "eval_pct": json_safe(lb.get("PILT")),
        },
        "right_leg": {
            "kg": json_safe(lb.get("LRL")),
            "pct": json_safe(lb.get("PLRL")),
            "eval_pct": json_safe(lb.get("PILRL")),
        },
        "left_leg": {
            "kg": json_safe(lb.get("LLL")),
            "pct": json_safe(lb.get("PLLL")),
            "eval_pct": json_safe(lb.get("PILLL")),
        },
        "diff_arm": json_safe(lb.get("DIFFARM")),
        "diff_leg": json_safe(lb.get("DIFFLEG")),
    }


def segmental_fat(lb: dict[str, Any]) -> dict[str, Any]:
    return {
        "right_arm": {"kg": json_safe(lb.get("FRA")), "pct": json_safe(lb.get("PBFRA"))},
        "left_arm": {"kg": json_safe(lb.get("FLA")), "pct": json_safe(lb.get("PBFLA"))},
        "trunk": {"kg": json_safe(lb.get("FT")), "pct": json_safe(lb.get("PBFT"))},
        "right_leg": {"kg": json_safe(lb.get("FRL")), "pct": json_safe(lb.get("PBFRL"))},
        "left_leg": {"kg": json_safe(lb.get("FLL")), "pct": json_safe(lb.get("PBFILL"))},
    }


def impedance_data(imp: dict[str, Any]) -> dict[str, Any]:
    freqs = ("1", "5", "20", "50", "100", "250", "500", "1M")
    segments = (
        ("right_arm", "IRA"),
        ("left_arm", "ILA"),
        ("trunk", "IT"),
        ("right_leg", "IRL"),
        ("left_leg", "ILL"),
    )
    out: dict[str, Any] = {}
    for label, suffix in (("1khz", "1"), ("5khz", "5"), ("20khz", "20"), ("50khz", "50"),
                          ("100khz", "100"), ("250khz", "250"), ("500khz", "500"), ("1mhz", "1M")):
        block: dict[str, Any] = {}
        for seg_name, prefix in segments:
            key = f"{prefix}{suffix}"
            if key in imp:
                block[seg_name] = json_safe(imp.get(key))
        if block:
            out[label] = block
    return out


def load_customer_map(cur, company_id: str) -> dict[str, str]:
    cur.execute(
        """
        SELECT id, tax_id
        FROM public.customers
        WHERE company_id = %s::uuid AND tax_id IS NOT NULL AND btrim(tax_id) <> ''
        """,
        (company_id,),
    )
    out: dict[str, str] = {}
    for cid, tax_id in cur.fetchall():
        for key in dni_match_keys(tax_id):
            if key not in out:
                out[key] = str(cid)
    return out


def build_rows(
    db: AccessParser,
    company_id: str,
    customer_by_tax: dict[str, str],
) -> tuple[list[tuple], dict[str, int]]:
    bca = table_dict(db, "BCA_TBL")
    mfa = table_dict(db, "MFA_TBL")
    lb = table_dict(db, "LB_TBL")
    imp = table_dict(db, "IMP_TBL")
    wc = table_dict(db, "WC_TBL")
    ed = table_dict(db, "ED_TBL")

    n = len(bca.get("DATETIMES", []))
    dict_rows: list[dict[str, Any]] = []
    stats = {"total": 0, "skipped_no_user": 0, "skipped_no_date": 0, "linked": 0, "unlinked": 0, "suspicious": 0}

    for idx in range(n):
        user_id = norm_inbody_user_id(str(bca.get("USERID", [""] * n)[idx] or "").strip())
        if not user_id:
            stats["skipped_no_user"] += 1
            continue

        measured_at = parse_measured_at(bca["DATETIMES"][idx])
        if not measured_at:
            stats["skipped_no_date"] += 1
            continue

        bca_row = row_dict(bca, idx)
        mfa_row = row_dict(mfa, idx)
        lb_row = row_dict(lb, idx)
        imp_row = row_dict(imp, idx)
        wc_row = row_dict(wc, idx)
        ed_row = row_dict(ed, idx)

        customer_id = find_customer_id(user_id, customer_by_tax)
        if customer_id:
            stats["linked"] += 1
        else:
            stats["unlinked"] += 1

        weight_kg = to_float(bca_row.get("WT"))
        bfm_min_kg, bfm_max_kg = body_fat_mass_range_kg(
            weight_kg,
            to_float(mfa_row.get("PBFM_MIN")),
            to_float(mfa_row.get("PBFM_MAx") or mfa_row.get("PBFM_MAX")),
        )

        dict_rows.append(
            {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "customer_id": customer_id,
                "inbody_user_id": user_id,
                "measured_at": measured_at,
                "height_cm": to_float(wc_row.get("HT")),
                "age_years": to_float(wc_row.get("AGE")),
                "sex": str(wc_row.get("SEX") or "").strip() or None,
                "weight_kg": weight_kg,
                "weight_min_kg": to_float(mfa_row.get("WT_MIN")),
                "weight_max_kg": to_float(mfa_row.get("WT_MAX")),
                "smm_kg": to_float(mfa_row.get("SMM")),
                "smm_min_kg": to_float(mfa_row.get("SMM_MIN")),
                "smm_max_kg": to_float(mfa_row.get("SMM_MAX")),
                "body_fat_kg": to_float(bca_row.get("BFM")),
                "body_fat_min_kg": bfm_min_kg,
                "body_fat_max_kg": bfm_max_kg,
                "tbw_kg": to_float(bca_row.get("TBW")),
                "tbw_min_kg": to_float(bca_row.get("TBW_MIN")),
                "tbw_max_kg": to_float(bca_row.get("TBW_MAX")),
                "ffm_kg": to_float(bca_row.get("FFM")),
                "ffm_min_kg": to_float(bca_row.get("FFM_MIN")),
                "ffm_max_kg": to_float(bca_row.get("FFM_MAX")),
                "slm_kg": to_float(bca_row.get("SLM")),
                "bmi": to_float(mfa_row.get("BMI")),
                "bmi_min": to_float(mfa_row.get("BMI_MIN")),
                "bmi_max": to_float(mfa_row.get("BMI_MAX")),
                "pbf_pct": to_float(mfa_row.get("PBF")),
                "pbf_min_pct": to_float(mfa_row.get("PBF_MIN")),
                "pbf_max_pct": to_float(mfa_row.get("PBF_MAX")),
                "whr": to_float(mfa_row.get("WHR")),
                "whr_min": to_float(mfa_row.get("WHR_MIN")),
                "whr_max": to_float(mfa_row.get("WHR_MAX")),
                "bmr_kcal": to_float(wc_row.get("BMR")),
                "bmr_min_kcal": to_float(wc_row.get("BMR_MIN")),
                "bmr_max_kcal": to_float(wc_row.get("BMR_MAX")),
                "fat_control_kg": to_float(wc_row.get("FC")),
                "muscle_control_kg": to_float(wc_row.get("MC")),
                "segmental_lean": segmental_lean(lb_row),
                "segmental_fat": segmental_fat(lb_row),
                "impedance": impedance_data(imp_row),
                "edema": compact_json({k: ed_row[k] for k in (
                    "NECK", "CHEST", "ABD", "HIP", "ACR", "ACL", "THIGHR", "THIGHL",
                    "FED", "WED", "AMC",
                ) if k in ed_row}),
                "bca": compact_json(bca_row),
                "mfa": compact_json(mfa_row),
                "lb": compact_json(lb_row),
                "wc": compact_json(wc_row),
                "imp": compact_json(imp_row),
                "ed": compact_json(ed_row),
                "source": "lookinbody_mdb",
                "import_batch": IMPORT_BATCH,
            }
        )
        stats["total"] += 1

    stats["suspicious"] = finalize_row_quality(dict_rows)
    rows = [row_to_insert_tuple(r) for r in dict_rows]
    return rows, stats


INSERT_SQL = """
INSERT INTO public.inbody_measurements (
  id, company_id, customer_id, inbody_user_id, measured_at,
  height_cm, age_years, sex,
  weight_kg, weight_min_kg, weight_max_kg,
  smm_kg, smm_min_kg, smm_max_kg,
  body_fat_kg, body_fat_min_kg, body_fat_max_kg,
  tbw_kg, tbw_min_kg, tbw_max_kg,
  ffm_kg, ffm_min_kg, ffm_max_kg, slm_kg,
  bmi, bmi_min, bmi_max,
  pbf_pct, pbf_min_pct, pbf_max_pct,
  whr, whr_min, whr_max,
  bmr_kcal, bmr_min_kcal, bmr_max_kcal,
  fat_control_kg, muscle_control_kg,
  segmental_lean, segmental_fat, impedance, edema,
  bca, mfa, lb, wc, imp, ed,
  data_quality, source, import_batch
) VALUES (
  %s::uuid, %s::uuid, %s::uuid, %s, %s,
  %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s,
  %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s, %s, %s, %s,
  %s, %s, %s
)
ON CONFLICT (company_id, inbody_user_id, measured_at) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  height_cm = EXCLUDED.height_cm,
  age_years = EXCLUDED.age_years,
  sex = EXCLUDED.sex,
  weight_kg = EXCLUDED.weight_kg,
  weight_min_kg = EXCLUDED.weight_min_kg,
  weight_max_kg = EXCLUDED.weight_max_kg,
  smm_kg = EXCLUDED.smm_kg,
  smm_min_kg = EXCLUDED.smm_min_kg,
  smm_max_kg = EXCLUDED.smm_max_kg,
  body_fat_kg = EXCLUDED.body_fat_kg,
  body_fat_min_kg = EXCLUDED.body_fat_min_kg,
  body_fat_max_kg = EXCLUDED.body_fat_max_kg,
  tbw_kg = EXCLUDED.tbw_kg,
  tbw_min_kg = EXCLUDED.tbw_min_kg,
  tbw_max_kg = EXCLUDED.tbw_max_kg,
  ffm_kg = EXCLUDED.ffm_kg,
  ffm_min_kg = EXCLUDED.ffm_min_kg,
  ffm_max_kg = EXCLUDED.ffm_max_kg,
  slm_kg = EXCLUDED.slm_kg,
  bmi = EXCLUDED.bmi,
  bmi_min = EXCLUDED.bmi_min,
  bmi_max = EXCLUDED.bmi_max,
  pbf_pct = EXCLUDED.pbf_pct,
  pbf_min_pct = EXCLUDED.pbf_min_pct,
  pbf_max_pct = EXCLUDED.pbf_max_pct,
  whr = EXCLUDED.whr,
  whr_min = EXCLUDED.whr_min,
  whr_max = EXCLUDED.whr_max,
  bmr_kcal = EXCLUDED.bmr_kcal,
  bmr_min_kcal = EXCLUDED.bmr_min_kcal,
  bmr_max_kcal = EXCLUDED.bmr_max_kcal,
  fat_control_kg = EXCLUDED.fat_control_kg,
  muscle_control_kg = EXCLUDED.muscle_control_kg,
  segmental_lean = EXCLUDED.segmental_lean,
  segmental_fat = EXCLUDED.segmental_fat,
  impedance = EXCLUDED.impedance,
  edema = EXCLUDED.edema,
  bca = EXCLUDED.bca,
  mfa = EXCLUDED.mfa,
  lb = EXCLUDED.lb,
  wc = EXCLUDED.wc,
  imp = EXCLUDED.imp,
  ed = EXCLUDED.ed,
  data_quality = EXCLUDED.data_quality,
  source = EXCLUDED.source,
  import_batch = EXCLUDED.import_batch,
  updated_at = now()
"""


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Importar LookinBody MDB → Supabase")
    parser.add_argument("--mdb", default=os.environ.get("LOOKINBODY_MDB_PATH", DEFAULT_MDB))
    parser.add_argument("--company-id", default=get_company_id())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replace-batch", action="store_true", help="Elimina filas del batch antes de importar")
    args = parser.parse_args()

    mdb_path = Path(args.mdb)
    if not mdb_path.is_file():
        raise SystemExit(f"No se encuentra el MDB: {mdb_path}")

    print(f"Leyendo {mdb_path} …")
    db = AccessParser(str(mdb_path))

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not db_url and not args.dry_run:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url) if db_url else None
    try:
        cur = conn.cursor() if conn else None
        customer_map = load_customer_map(cur, args.company_id) if cur else {}
        rows, stats = build_rows(db, args.company_id, customer_map)

        print(f"Mediciones preparadas: {stats['total']}")
        print(f"  Vinculadas a cliente (DNI): {stats['linked']}")
        print(f"  Sin ficha en Suite: {stats['unlinked']}")
        print(f"  Omitidas sin USERID: {stats['skipped_no_user']}")
        print(f"  Omitidas sin fecha: {stats['skipped_no_date']}")
        print(f"  Posiblemente erróneas (repetir escaneo): {stats.get('suspicious', 0)}")

        if args.dry_run:
            print("Dry-run: no se escribe en la base de datos.")
            if rows:
                sample = rows[-1]
                print(f"Última medición: user={sample[3]} at={sample[4]} customer_id={sample[2]}")
            return

        assert conn is not None and cur is not None
        if args.replace_batch:
            cur.execute(
                "DELETE FROM public.inbody_measurements WHERE company_id = %s::uuid AND import_batch = %s",
                (args.company_id, IMPORT_BATCH),
            )
            print(f"Eliminadas filas previas del batch {IMPORT_BATCH!r}: {cur.rowcount}")

        execute_batch(cur, INSERT_SQL, rows, page_size=200)
        conn.commit()
        print(f"Importadas/actualizadas {len(rows)} mediciones.")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
