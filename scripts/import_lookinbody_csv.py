"""
Importa mediciones InBody desde dbbackup.CSV (Lookin'Body) → public.inbody_measurements.

Formato esperado: exportación con columnas ID, Date&Times, 1.Weight, 4.Skeletal Muscle Mass…

Requisitos:
  pip install psycopg2-binary
  SUPABASE_DB_URL en .env

Uso:
  python scripts/import_lookinbody_csv.py "c:\\Duna\\inbodydb\\dbbackup.CSV"
  python scripts/import_lookinbody_csv.py --dry-run
  python scripts/import_lookinbody_csv.py --dni 32763257X
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

MADRID = ZoneInfo("Europe/Madrid")

try:
    import psycopg2
    from psycopg2.extras import Json, execute_batch
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_company import get_company_id

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = r"c:\Duna\inbodydb\dbbackup.CSV"
IMPORT_BATCH = "lookinbody_dbbackup_csv"
SOURCE = "lookinbody_dbbackup_csv"


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


def clean_cell(value: object) -> str:
    return re.sub(r"^'+|'+$", "", str(value or "").replace("\x00", "").strip())


def is_blank_row(cells: list[str]) -> bool:
    return not any(clean_cell(c) for c in cells)


def norm_tax_id(value: object) -> str | None:
    s = re.sub(r"[\s\-\.]", "", str(value or "")).upper()
    return s if s else None


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


def to_float(value: object) -> float | None:
    s = clean_cell(str(value)).replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def norm_inbody_user_id(raw: str) -> str:
    return re.sub(r"[\s\-.]", "", (raw or "").strip()).upper()


def parse_measured_at(raw: str) -> datetime | None:
    s = clean_cell(raw)
    m = re.match(
        r"^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$",
        s,
        re.I,
    )
    if m:
        hour = int(m.group(4))
        minute = int(m.group(5))
        second = int(m.group(6))
        ampm = (m.group(7) or "").upper()
        if ampm == "PM" and hour < 12:
            hour += 12
        if ampm == "AM" and hour == 12:
            hour = 0
        return datetime(
            int(m.group(1)), int(m.group(2)), int(m.group(3)), hour, minute, second, tzinfo=MADRID
        )
    if len(s) == 14 and s.isdigit():
        try:
            return datetime.strptime(s, "%Y%m%d%H%M%S").replace(tzinfo=MADRID)
        except ValueError:
            return None
    try:
        dt = datetime.fromisoformat(s.replace(" ", "T"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=MADRID)
        return dt.astimezone(MADRID)
    except ValueError:
        return None


def is_dbbackup(headers: list[str]) -> bool:
    return clean_cell(headers[0]).upper() == "ID" and "weight" in clean_cell(headers[5]).lower()


def parse_dbbackup_row(cells: list[str]) -> dict[str, Any]:
    def c(i: int) -> str:
        return clean_cell(cells[i]) if i < len(cells) else ""

    def f(i: int) -> float | None:
        return to_float(c(i))

    segmental_lean = {
        "left_arm": {"kg": f(34), "eval_pct": f(39)},
        "right_arm": {"kg": f(35), "eval_pct": f(40)},
        "trunk": {"kg": f(36), "eval_pct": f(41)},
        "left_leg": {"kg": f(37), "eval_pct": f(42)},
        "right_leg": {"kg": f(38), "eval_pct": f(43)},
    }
    segmental_fat = {
        "left_arm": {"pct": f(44), "kg": f(49)},
        "right_arm": {"pct": f(45), "kg": f(50)},
        "trunk": {"pct": f(46), "kg": f(51)},
        "left_leg": {"pct": f(47), "kg": f(52)},
        "right_leg": {"pct": f(48), "kg": f(53)},
    }
    impedance: dict[str, dict[str, float | None]] = {}
    z20 = {
        "right_arm": f(55),
        "left_arm": f(56),
        "trunk": f(57),
        "right_leg": f(58),
        "left_leg": f(59),
    }
    z100 = {
        "right_arm": f(60),
        "left_arm": f(61),
        "trunk": f(62),
        "right_leg": f(63),
        "left_leg": f(64),
    }
    if any(v is not None for v in z20.values()):
        impedance["20khz"] = z20
    if any(v is not None for v in z100.values()):
        impedance["100khz"] = z100

    measured = parse_measured_at(c(1))
    user_id = norm_inbody_user_id(norm_tax_id(c(0)))

    return {
        "inbody_user_id": user_id,
        "measured_at": measured,
        "height_cm": f(3),
        "age_years": f(2),
        "sex": c(4) or None,
        "weight_kg": f(5),
        "weight_min_kg": f(6),
        "weight_max_kg": f(7),
        "smm_kg": f(8),
        "smm_min_kg": f(9),
        "smm_max_kg": f(10),
        "body_fat_kg": f(11),
        "body_fat_min_kg": f(12),
        "body_fat_max_kg": f(13),
        "tbw_kg": f(14),
        "tbw_min_kg": f(15),
        "tbw_max_kg": f(16),
        "ffm_kg": f(17),
        "ffm_min_kg": f(18),
        "ffm_max_kg": f(19),
        "slm_kg": None,
        "bmi": f(20),
        "bmi_min": f(21),
        "bmi_max": f(22),
        "pbf_pct": f(23),
        "pbf_min_pct": f(24),
        "pbf_max_pct": f(25),
        "whr": f(26),
        "whr_min": f(27),
        "whr_max": f(28),
        "bmr_kcal": f(29),
        "bmr_min_kcal": f(30),
        "bmr_max_kcal": f(31),
        "muscle_control_kg": f(32),
        "fat_control_kg": f(33),
        "segmental_lean": segmental_lean,
        "segmental_fat": segmental_fat,
        "impedance": impedance,
        "edema": {},
        "bca": {f"col_{i}": c(i) for i in range(min(len(cells), 65))},
    }


def load_customer_map(conn, company_id: str) -> dict[str, str]:
    lookup: dict[str, str] = {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, tax_id FROM public.customers WHERE company_id = %s::uuid AND tax_id IS NOT NULL",
            (company_id,),
        )
        for customer_id, tax_id in cur.fetchall():
            for key in dni_match_keys(tax_id):
                lookup.setdefault(key, str(customer_id))
    return lookup


def find_customer_id(user_id: str | None, lookup: dict[str, str]) -> str | None:
    if not user_id:
        return None
    for key in dni_match_keys(user_id):
        cid = lookup.get(key)
        if cid:
            return cid
    return None


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
  source, import_batch
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
  %s, %s
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
  source = EXCLUDED.source,
  import_batch = EXCLUDED.import_batch,
  updated_at = now()
"""


def row_to_tuple(company_id: str, customer_id: str | None, parsed: dict[str, Any]) -> tuple[Any, ...]:
    lb = {"segmental_lean": parsed["segmental_lean"], "segmental_fat": parsed["segmental_fat"]}
    return (
        str(uuid.uuid4()),
        company_id,
        customer_id,
        parsed["inbody_user_id"],
        parsed["measured_at"],
        parsed["height_cm"],
        parsed["age_years"],
        parsed["sex"],
        parsed["weight_kg"],
        parsed["weight_min_kg"],
        parsed["weight_max_kg"],
        parsed["smm_kg"],
        parsed["smm_min_kg"],
        parsed["smm_max_kg"],
        parsed["body_fat_kg"],
        parsed["body_fat_min_kg"],
        parsed["body_fat_max_kg"],
        parsed["tbw_kg"],
        parsed["tbw_min_kg"],
        parsed["tbw_max_kg"],
        parsed["ffm_kg"],
        parsed["ffm_min_kg"],
        parsed["ffm_max_kg"],
        parsed["slm_kg"],
        parsed["bmi"],
        parsed["bmi_min"],
        parsed["bmi_max"],
        parsed["pbf_pct"],
        parsed["pbf_min_pct"],
        parsed["pbf_max_pct"],
        parsed["whr"],
        parsed["whr_min"],
        parsed["whr_max"],
        parsed["bmr_kcal"],
        parsed["bmr_min_kcal"],
        parsed["bmr_max_kcal"],
        parsed["fat_control_kg"],
        parsed["muscle_control_kg"],
        Json(parsed["segmental_lean"]),
        Json(parsed["segmental_fat"]),
        Json(parsed["impedance"]),
        Json(parsed["edema"]),
        Json(parsed["bca"]),
        Json({}),
        Json(lb),
        Json({}),
        Json(parsed["impedance"]),
        Json({}),
        SOURCE,
        IMPORT_BATCH,
    )


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Importar LookinBody dbbackup.CSV → Supabase")
    parser.add_argument("csv", nargs="?", default=os.environ.get("LOOKINBODY_CSV_PATH", DEFAULT_CSV))
    parser.add_argument("--company-id", default=get_company_id())
    parser.add_argument("--dni", help="Importar solo este DNI / ID InBody")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.is_file():
        print(f"No existe: {csv_path}", file=sys.stderr)
        sys.exit(1)

    with csv_path.open(encoding="utf-8-sig", errors="replace", newline="") as fh:
        reader = csv.reader(fh)
        headers = next(reader, None)
        if not headers or not is_dbbackup(headers):
            print("Formato no reconocido (se espera dbbackup.CSV de Lookin'Body)", file=sys.stderr)
            sys.exit(1)

        parsed_rows: list[dict[str, Any]] = []
        skipped = 0
        skipped_blank = 0
        for line_no, cells in enumerate(reader, start=2):
            if is_blank_row(cells):
                skipped_blank += 1
                continue
            row = parse_dbbackup_row(cells)
            if args.dni and norm_tax_id(args.dni) != row.get("inbody_user_id"):
                continue
            if not row.get("inbody_user_id") or not row.get("measured_at"):
                has_hints = any(
                    clean_cell(cells[i]) if i < len(cells) else ""
                    for i in (0, 1, 5)
                )
                if has_hints:
                    skipped += 1
                    if not row.get("inbody_user_id"):
                        print(f"Fila {line_no}: omitida — falta DNI", file=sys.stderr)
                    else:
                        print(f"Fila {line_no}: omitida — fecha inválida", file=sys.stderr)
                else:
                    skipped_blank += 1
                continue
            parsed_rows.append(row)

    print(f"Filas válidas: {len(parsed_rows)} (omitidas: {skipped}, vacías: {skipped_blank})")
    if args.dni:
        print(f"Filtro DNI: {norm_tax_id(args.dni)}")

    if args.dry_run:
        for row in parsed_rows[:5]:
            print(
                row["inbody_user_id"],
                row["measured_at"],
                row.get("weight_kg"),
                row.get("pbf_pct"),
            )
        return

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("Falta SUPABASE_DB_URL en .env", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    try:
        lookup = load_customer_map(conn, args.company_id)
        tuples = []
        linked = 0
        for row in parsed_rows:
            customer_id = find_customer_id(row["inbody_user_id"], lookup)
            if customer_id:
                linked += 1
            tuples.append(row_to_tuple(args.company_id, customer_id, row))

        with conn.cursor() as cur:
            execute_batch(cur, INSERT_SQL, tuples, page_size=100)
        conn.commit()
        print(f"Importadas/actualizadas: {len(tuples)} ({linked} vinculadas a ficha)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
