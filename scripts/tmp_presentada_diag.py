"""Diagnóstico: leads cliente+cita no Presentada vs facturación."""
from __future__ import annotations

import os
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import psycopg2
import psycopg2.extras

DEFAULT_COMPANY_ID = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"


def load_db_url() -> str:
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))
    return os.environ["SUPABASE_DB_URL"]


def digits_only(raw):
    return re.sub(r"\D", "", raw or "")


def phone_variants(raw):
    d = digits_only(raw)
    if not d:
        return []
    out = {d}
    if len(d) > 9:
        out.add(d[-9:])
    if len(d) > 7:
        out.add(d[-7:])
    return list(out)


def is_presentada(name):
    if not name:
        return False
    n = unicodedata.normalize("NFD", name.strip().lower())
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    return "presentada" in n and "exito" in n


def main():
    company_id = DEFAULT_COMPANY_ID
    conn = psycopg2.connect(load_db_url())
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT id, name FROM marketing_lead_stages WHERE company_id=%s", (company_id,))
    stages = {r["id"]: r["name"] for r in cur.fetchall()}
    presentada_id = next(k for k, v in stages.items() if is_presentada(v))

    cur.execute(
        "SELECT id, email, phone, phone_mobile, phone_home FROM customers WHERE company_id=%s",
        (company_id,),
    )
    by_phone, by_email = {}, {}
    for c in cur.fetchall():
        for ph in (c["phone"], c["phone_mobile"], c["phone_home"]):
            for v in phone_variants(ph):
                by_phone.setdefault(v, c["id"])
        e = (c["email"] or "").strip().lower()
        if e:
            by_email[e] = c["id"]

    def match_cid(lead):
        if lead["customer_id"]:
            return lead["customer_id"]
        for v in phone_variants(lead["phone"]):
            if v in by_phone:
                return by_phone[v]
        e = (lead["email"] or "").strip().lower()
        return by_email.get(e)

    cur.execute(
        """
        SELECT id, stage_id, customer_id, phone, email, created_at, external_created_at,
               first_name, last_name, value
        FROM marketing_leads
        WHERE company_id=%s AND archived_at IS NULL
        """,
        (company_id,),
    )
    leads = cur.fetchall()

    cur.execute(
        """
        SELECT customer_id, issue_date::text d, total_amount, id
        FROM invoices
        WHERE company_id=%s AND status IS DISTINCT FROM 'cancelled' AND customer_id IS NOT NULL
        """,
        (company_id,),
    )
    inv_by_c = defaultdict(list)
    for r in cur.fetchall():
        inv_by_c[r["customer_id"]].append(r)

    cur.execute(
        """
        SELECT appointment_id, invoice_id, customer_id, status
        FROM sales WHERE company_id=%s AND appointment_id IS NOT NULL AND invoice_id IS NOT NULL
        """,
        (company_id,),
    )
    sales = cur.fetchall()
    appt_inv = {r["invoice_id"] for r in sales if r["status"] == "completed"}

    cur.execute(
        """
        SELECT customer_id,
               (appointment_date::timestamp + COALESCE(NULLIF(start_time,''),'00:00')::time) starts_at
        FROM agenda_appointments WHERE company_id=%s AND customer_id IS NOT NULL
        """,
        (company_id,),
    )
    appts = defaultdict(list)
    for r in cur.fetchall():
        appts[r["customer_id"]].append(r["starts_at"])

    print("lead | stage | appt | any_inv | appt_inv | total")
    count = 0
    for lead in leads:
        cid = match_cid(lead)
        if not cid:
            continue
        if lead["stage_id"] == presentada_id:
            continue
        lead_ts = lead["created_at"].replace(tzinfo=None) if lead["created_at"].tzinfo else lead["created_at"]
        has_appt = any(
            (a.replace(tzinfo=None) if getattr(a, "tzinfo", None) else a) >= lead_ts
            for a in appts.get(cid, [])
        )
        if not has_appt:
            continue
        count += 1
        since = str(lead["external_created_at"] or lead["created_at"])[:10]
        invs = [i for i in inv_by_c.get(cid, []) if i["d"] >= since and float(i["total_amount"] or 0) > 0]
        any_inv = len(invs) > 0
        appt_invs = [i for i in invs if i["id"] in appt_inv]
        total = sum(float(i["total_amount"]) for i in invs)
        name = f"{lead['first_name'] or ''} {lead['last_name'] or ''}".strip()[:30]
        print(
            f"{name:30} | {stages.get(lead['stage_id'],'?'):22} | appt | any={any_inv} appt_inv={len(appt_invs)>0} | {total:.0f}"
        )
    print(f"\nTotal cliente+cita+no Presentada: {count}")
    conn.close()


if __name__ == "__main__":
    main()
