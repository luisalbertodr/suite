"""Busca facturación de cita más amplia para leads pendientes."""
import os, re, unicodedata
from pathlib import Path
from collections import defaultdict
import psycopg2, psycopg2.extras

DEFAULT = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k,v=line.split("=",1); os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def digits(s): return re.sub(r"\D","",s or "")
def pvars(s):
    d=digits(s)
    if not d: return []
    o={d}
    if len(d)>9: o.add(d[-9:])
    return list(o)

def is_pres(n):
    n=unicodedata.normalize("NFD",(n or "").lower())
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    return "presentada" in n and "exito" in n

cur.execute("SELECT id,name FROM marketing_lead_stages WHERE company_id=%s",(DEFAULT,))
stages={r["id"]:r["name"] for r in cur.fetchall()}
pres_id=next(k for k,v in stages.items() if is_pres(v))

cur.execute("SELECT id,email,phone,phone_mobile,phone_home FROM customers WHERE company_id=%s",(DEFAULT,))
bp,be={},{}
for c in cur.fetchall():
    for ph in (c["phone"],c["phone_mobile"],c["phone_home"]):
        for v in pvars(ph): bp.setdefault(v,c["id"])
    e=(c["email"] or "").lower().strip()
    if e: be[e]=c["id"]

cur.execute("""SELECT id,stage_id,phone,email,customer_id,created_at,external_created_at,first_name,last_name,value
FROM marketing_leads WHERE company_id=%s AND archived_at IS NULL""",(DEFAULT,))
leads=cur.fetchall()

cur.execute("""SELECT id,customer_id,issue_date::text d,total_amount,number,notes FROM invoices
WHERE company_id=%s AND status IS DISTINCT FROM 'cancelled'""",(DEFAULT,))
inv=defaultdict(list)
for r in cur.fetchall():
    if r["customer_id"]: inv[r["customer_id"]].append(r)

cur.execute("""SELECT id,customer_id,(appointment_date::timestamp+COALESCE(NULLIF(start_time,''),'00:00')::time) t
FROM agenda_appointments WHERE company_id=%s AND customer_id IS NOT NULL""",(DEFAULT,))
ap=defaultdict(list)
for r in cur.fetchall(): ap[r["customer_id"]].append(r["t"])

cur.execute("""SELECT appointment_id,invoice_id,customer_id,status,total_amount,ticket_number FROM sales
WHERE appointment_id IS NOT NULL""")
sales=cur.fetchall()
appt_inv=set()
for s in sales:
    if s["status"]=="completed" and s["invoice_id"]: appt_inv.add(s["invoice_id"])

print("PENDIENTES con cita (no Presentada):")
for lead in leads:
    if lead["stage_id"]==pres_id: continue
    cid=lead["customer_id"]
    if not cid:
        for v in pvars(lead["phone"]):
            if v in bp: cid=bp[v]; break
        if not cid:
            e=(lead["email"] or "").lower().strip()
            cid=be.get(e)
    if not cid: continue
    lt=lead["created_at"].replace(tzinfo=None)
    if not any((a.replace(tzinfo=None) if getattr(a,"tzinfo",None) else a)>=lt for a in ap.get(cid,[])):
        continue
    since=str(lead["external_created_at"] or lead["created_at"])[:10]
    invs=[i for i in inv.get(cid,[]) if i["d"]>=since and float(i["total_amount"] or 0)>0]
    name=f"{lead['first_name'] or ''} {lead['last_name'] or ''}".strip()
    print(f"\n{name} | {stages.get(lead['stage_id'],'?')}")
    print(f"  facturas desde lead: {len(invs)}")
    for i in invs:
        linked = i["id"] in appt_inv
        print(f"    {i['number']} {i['d']} {i['total_amount']} appt_sale={linked} | {(i['notes'] or '')[:50]}")
    # sales completed on their appts
    cur.execute("""SELECT s.ticket_number,s.total_amount,s.status,s.invoice_id,s.appointment_id
      FROM sales s JOIN agenda_appointments ap ON ap.id=s.appointment_id
      WHERE ap.customer_id=%s AND ap.company_id=%s AND s.status='completed'""",(cid,DEFAULT))
    ss=cur.fetchall()
    if ss:
        print(f"  ventas cita completadas: {len(ss)}")
        for s in ss:
            print(f"    {s['ticket_number']} {s['total_amount']} inv={s['invoice_id']}")

conn.close()
