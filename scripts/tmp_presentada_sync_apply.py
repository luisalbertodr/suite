"""Encuentra todos los leads que deben ir a Presentada con éxito y los mueve."""
import os, re, unicodedata
from pathlib import Path
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
import psycopg2, psycopg2.extras

DEFAULT = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

def digits(s): return re.sub(r"\D", "", s or "")
def pvars(s):
    d = digits(s)
    if not d: return []
    o = {d}
    if len(d) > 9: o.add(d[-9:])
    if len(d) > 7: o.add(d[-7:])
    return list(o)

def is_pres(name):
    n = unicodedata.normalize("NFD", (name or "").lower())
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    return "presentada" in n and "exito" in n

def round_money(v):
    return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT id, name FROM marketing_lead_stages WHERE company_id=%s", (DEFAULT,))
stages = {r["id"]: r["name"] for r in cur.fetchall()}
pres_id = next(k for k, v in stages.items() if is_pres(v))
pres_name = stages[pres_id]

cur.execute("SELECT id, email, phone, phone_mobile, phone_home FROM customers WHERE company_id=%s", (DEFAULT,))
bp, be = {}, {}
for c in cur.fetchall():
    for ph in (c["phone"], c["phone_mobile"], c["phone_home"]):
        for v in pvars(ph): bp.setdefault(v, c["id"])
    e = (c["email"] or "").strip().lower()
    if e: be[e] = c["id"]

def match_cid(lead):
    if lead["customer_id"]: return lead["customer_id"]
    for v in pvars(lead["phone"]):
        if v in bp: return bp[v]
    return be.get((lead["email"] or "").strip().lower())

cur.execute(
    """SELECT id, stage_id, customer_id, phone, email, value, external_created_at, created_at, first_name, last_name
    FROM marketing_leads WHERE company_id=%s AND archived_at IS NULL""",
    (DEFAULT,),
)
leads = cur.fetchall()

cur.execute(
    """SELECT id, customer_id, issue_date::text AS d, total_amount
    FROM invoices WHERE company_id=%s AND status IS DISTINCT FROM 'cancelled'
      AND customer_id IS NOT NULL AND COALESCE(total_amount,0) > 0""",
    (DEFAULT,),
)
inv_by_c = defaultdict(list)
for r in cur.fetchall():
    inv_by_c[r["customer_id"]].append(r)

# Facturas de cita: venta completada con appointment_id + invoice_id
cur.execute(
    """SELECT s.invoice_id, i.customer_id, i.issue_date::text AS d
    FROM sales s
    JOIN invoices i ON i.id = s.invoice_id
    WHERE s.status = 'completed'
      AND s.appointment_id IS NOT NULL
      AND s.invoice_id IS NOT NULL
      AND i.status IS DISTINCT FROM 'cancelled'"""
)
appt_inv_keys = set()
appt_inv_by_c = defaultdict(list)
for r in cur.fetchall():
    appt_inv_keys.add(r["invoice_id"])
    if r["customer_id"]:
        appt_inv_by_c[r["customer_id"]].append(r)

def since_date(lead):
    return str(lead["external_created_at"] or lead["created_at"])[:10]

def sum_since(cid, since):
    return round_money(sum(float(i["total_amount"]) for i in inv_by_c.get(cid, []) if i["d"] >= since))

def has_appt_inv_since(cid, since):
    for i in inv_by_c.get(cid, []):
        if i["d"] >= since and i["id"] in appt_inv_keys:
            return True
    return False

to_move, to_update = [], []
for lead in leads:
    cid = match_cid(lead)
    if not cid: continue
    since = since_date(lead)
    if not has_appt_inv_since(cid, since):
        continue
    total = sum_since(cid, since)
    if total <= 0: continue
    name = f"{lead['first_name'] or ''} {lead['last_name'] or ''}".strip()
    if lead["stage_id"] == pres_id:
        if abs(float(lead["value"] or 0) - total) >= 0.01:
            to_update.append({"id": lead["id"], "name": name, "value": total})
    else:
        to_move.append({
            "id": lead["id"], "name": name,
            "stage": stages.get(lead["stage_id"], "?"),
            "value": total, "since": since,
        })

print(f"Etapa: {pres_name}")
print(f"Mover: {len(to_move)} | Actualizar valor: {len(to_update)}")
for r in to_move:
    print(f"  MOVE {r['name'] or r['id'][:8]} | {r['stage']} | {r['value']:.2f} EUR (desde {r['since']})")
for r in to_update:
    print(f"  VAL  {r['name'] or r['id'][:8]} | -> {r['value']:.2f} EUR")

cur.execute(
    "SELECT COALESCE(MAX(position_in_stage), -1) + 1 AS n FROM marketing_leads WHERE stage_id=%s AND archived_at IS NULL",
    (pres_id,),
)
pos = int(cur.fetchone()["n"])
moved = updated = 0
for r in to_move:
    cur.execute(
        "UPDATE marketing_leads SET stage_id=%s, position_in_stage=%s, value=%s, updated_at=NOW() WHERE id=%s",
        (pres_id, pos, r["value"], r["id"]),
    )
    pos += 1
    moved += 1
for r in to_update:
    cur.execute("UPDATE marketing_leads SET value=%s, updated_at=NOW() WHERE id=%s", (r["value"], r["id"]))
    updated += 1
conn.commit()
print(f"\nOK: {moved} movidos, {updated} valores actualizados")
conn.close()
