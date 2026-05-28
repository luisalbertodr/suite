import json
from collections import OrderedDict

from supabase import create_client

from legacy_company import DEFAULT_COMPANY_ID

URL = "https://supabase.lipoout.com"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2Nzg4ODY0MDAsImV4cCI6MTc5OTUzNTYwMH0.T_fOOOaoiFAyTLDkSCoaGwxy7TjlacSHJn2aZyCFP0M"
COMPANY_ID = DEFAULT_COMPANY_ID
PLANINC_PATH = r"E:/APP Lipoout/dbf/APP_READY/PLANINC.json"


def norm_date(value):
    v = str(value or "").strip()
    if len(v) == 8 and v.isdigit():
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}"
    if len(v) == 10 and v[4] == "-":
        return v
    return None


def norm_time(value, default="09:00"):
    t = str(value or "").strip()
    if not t:
        return default
    if len(t) == 4 and t.isdigit():
        t = f"{t[:2]}:{t[2:]}"
    if len(t) >= 5 and t[2] == ":":
        return t[:5]
    return default


def main():
    supabase = create_client(URL, KEY)

    with open(PLANINC_PATH, "r", encoding="utf-8") as f:
        source_rows = json.load(f)
    print("source_rows", len(source_rows))

    emp_rows = (
        supabase.table("agenda_employees")
        .select("id,dunasoft_codemp")
        .eq("company_id", COMPANY_ID)
        .execute()
        .data
        or []
    )
    employee_map = {}
    fallback_employee_id = None
    for row in emp_rows:
        code = str(row.get("dunasoft_codemp") or "").strip()
        if code:
            employee_map[code] = row["id"]
        if str(row.get("name") or "").strip().lower() == "sin asignar":
            fallback_employee_id = row["id"]

    if not fallback_employee_id:
        created = (
            supabase.table("agenda_employees")
            .insert(
                [
                    {
                        "company_id": COMPANY_ID,
                        "name": "Sin asignar",
                        "color": "#3B82F6",
                        "is_active": True,
                    }
                ]
            )
            .execute()
        )
        fallback_employee_id = created.data[0]["id"]

    supabase.table("agenda_appointments").delete().eq("company_id", COMPANY_ID).execute()

    unique = OrderedDict()
    for r in source_rows:
        date = norm_date(r.get("FECHA"))
        if not date:
            continue

        start_time = norm_time(r.get("HORINI"))
        end_time = norm_time(r.get("HORFIN"))
        codemp_raw = str(r.get("CODEMP") or "").strip()
        codemp_norm = codemp_raw.lstrip("0") or "0"
        employee_id = employee_map.get(codemp_norm) or fallback_employee_id

        nomcli = str(r.get("NOMCLI") or "").strip()
        codcli = str(r.get("CODCLI") or "").strip()
        client_name = nomcli or codcli or "Cliente"

        planart = str(r.get("PLANART") or "").strip()
        texto = str(r.get("TEXTO") or "").strip()
        description = planart or texto or "Cita importada"

        planinc_id = r.get("IDPLANINC")
        legacy_planinc_id = int(planinc_id) if str(planinc_id or "").strip().isdigit() else None

        dedupe_key = "|".join(
            [
                str(legacy_planinc_id or ""),
                date,
                start_time,
                codemp_raw,
                codcli,
                client_name,
                description,
            ]
        )
        if dedupe_key in unique:
            continue

        unique[dedupe_key] = {
            "company_id": COMPANY_ID,
            "employee_id": employee_id,
            "client_name": client_name[:120],
            "description": description[:1000],
            "start_time": start_time,
            "end_time": end_time,
            "appointment_date": date,
            "color": "bg-blue-100 border-blue-300",
            "status": "confirmed",
            "legacy_planinc_id": legacy_planinc_id,
            "legacy_codemp": codemp_raw,
            "legacy_codcli": codcli,
        }

    payload = list(unique.values())
    print("unique_prepared", len(payload))

    inserted = 0
    batch_size = 500
    for i in range(0, len(payload), batch_size):
        chunk = payload[i : i + batch_size]
        res = supabase.table("agenda_appointments").insert(chunk).execute()
        if res.data is not None:
            inserted += len(res.data)
        if inserted and inserted % 10000 == 0:
            print("inserted", inserted)

    count = (
        supabase.table("agenda_appointments")
        .select("id", count="exact")
        .eq("company_id", COMPANY_ID)
        .execute()
        .count
    )
    sample = (
        supabase.table("agenda_appointments")
        .select("appointment_date,client_name,legacy_codcli,legacy_codemp")
        .eq("company_id", COMPANY_ID)
        .limit(8)
        .execute()
        .data
    )
    print("inserted_total", inserted)
    print("count", count)
    print("sample", sample)


if __name__ == "__main__":
    main()

