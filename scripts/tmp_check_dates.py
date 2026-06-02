import os,re
from pathlib import Path
import psycopg2, psycopg2.extras

DEFAULT="5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v=line.split('=',1); os.environ.setdefault(k.strip(), v.strip().strip('"'))

def digits(s): return re.sub(r'\D','',s or '')
def pvars(s):
    d=digits(s); o={d} if d else set()
    if len(d)>9: o.add(d[-9:])
    return list(o)

conn=psycopg2.connect(os.environ['SUPABASE_DB_URL'])
cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute('SELECT id,phone,phone_mobile,phone_home,email FROM customers WHERE company_id=%s',(DEFAULT,))
bp,be={},{}
for c in cur.fetchall():
    for ph in (c['phone'],c['phone_mobile'],c['phone_home']):
        for v in pvars(ph): bp.setdefault(v,c['id'])
    e=(c['email'] or '').strip().lower()
    if e: be[e]=c['id']

for fname in ['Tere Montoto','Mary ojeda','Lumaciel']:
    cur.execute("SELECT * FROM marketing_leads WHERE first_name ILIKE %s AND archived_at IS NULL LIMIT 1",(fname.split()[0]+'%',))
    lead=cur.fetchone()
    cid=lead['customer_id']
    if not cid:
        for v in pvars(lead['phone']):
            if v in bp: cid=bp[v]; break
    since=str(lead['external_created_at'] or lead['created_at'])[:10]
    print('\n===', fname, 'lead', since, 'cid', cid)
    cur.execute('''SELECT COUNT(*), MIN(i.issue_date), MAX(i.issue_date), SUM(i.total_amount)
      FROM sales s JOIN invoices i ON i.id=s.invoice_id
      JOIN agenda_appointments ap ON ap.id=s.appointment_id
      WHERE ap.customer_id=%s AND i.issue_date >= %s''',(cid,since))
    print('appt inv since lead:', cur.fetchone())
    cur.execute('''SELECT COUNT(*), SUM(total_amount) FROM invoices WHERE customer_id=%s AND issue_date >= %s AND status IS DISTINCT FROM 'cancelled''' ,(cid,since))
    print('any inv since lead:', cur.fetchone())
conn.close()
