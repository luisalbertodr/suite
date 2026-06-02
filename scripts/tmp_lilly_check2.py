import os,re
from pathlib import Path
import psycopg2, psycopg2.extras

DEFAULT="5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k,v=line.split('=',1); os.environ.setdefault(k.strip(), v.strip().strip('"'))

def digits(s): return re.sub(r'\D','',s or '')
def pvars(s):
    d=digits(s); o={d} if d else set()
    if len(d)>9: o.add(d[-9:])
    return list(o)

conn=psycopg2.connect(os.environ['SUPABASE_DB_URL'])
cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT id,phone,email,customer_id,created_at,external_created_at,first_name FROM marketing_leads WHERE first_name ILIKE 'Lilly%' AND archived_at IS NULL")
lead=cur.fetchone(); print('LEAD', lead)

cur.execute("SELECT id,phone,phone_mobile,name FROM customers WHERE company_id=%s",(DEFAULT,))
bp={}
for c in cur.fetchall():
    for ph in (c['phone'],c['phone_mobile']):
        for v in pvars(ph): bp.setdefault(v,c)

cid=lead['customer_id']
if not cid:
    for v in pvars(lead['phone']):
        if v in bp: cid=bp[v]['id']; print('MATCH', bp[v]); break

since=str(lead['external_created_at'] or lead['created_at'])[:10]
print('CID', cid, 'since', since, 'created', lead['created_at'])

cur.execute("""SELECT appointment_date,start_time,status FROM agenda_appointments
WHERE customer_id=%s AND company_id=%s ORDER BY appointment_date DESC LIMIT 5""",(cid,DEFAULT))
print('APPTS', cur.fetchall())

cur.execute("""SELECT s.ticket_number,s.created_at,i.issue_date,i.total_amount,s.invoice_id
FROM sales s LEFT JOIN invoices i ON i.id=s.invoice_id
WHERE s.appointment_id IN (SELECT id FROM agenda_appointments WHERE customer_id=%s)
ORDER BY s.created_at DESC LIMIT 5""",(cid,))
print('SALES', cur.fetchall())
conn.close()
