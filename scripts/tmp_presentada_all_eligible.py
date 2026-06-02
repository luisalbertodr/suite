import os,re,unicodedata
from pathlib import Path
from collections import defaultdict
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
def is_pres(n):
    n=unicodedata.normalize('NFD',(n or '').lower())
    n=''.join(c for c in n if unicodedata.category(c)!='Mn')
    return 'presentada' in n and 'exito' in n

conn=psycopg2.connect(os.environ['SUPABASE_DB_URL'])
cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute('SELECT id,name FROM marketing_lead_stages WHERE company_id=%s',(DEFAULT,))
st={r['id']:r['name'] for r in cur.fetchall()}
pres=next(k for k,v in st.items() if is_pres(v))
cur.execute('SELECT id,phone,phone_mobile,phone_home,email FROM customers WHERE company_id=%s',(DEFAULT,))
bp,be={},{}
for c in cur.fetchall():
    for ph in (c['phone'],c['phone_mobile'],c['phone_home']):
        for v in pvars(ph): bp.setdefault(v,c['id'])
    e=(c['email'] or '').strip().lower()
    if e: be[e]=c['id']
cur.execute('SELECT id,stage_id,phone,email,customer_id,created_at,external_created_at,first_name,last_name,value FROM marketing_leads WHERE company_id=%s AND archived_at IS NULL',(DEFAULT,))
leads=cur.fetchall()
cur.execute('''SELECT id,customer_id,issue_date::text d,total_amount FROM invoices WHERE company_id=%s AND status IS DISTINCT FROM 'cancelled' AND customer_id IS NOT NULL''',(DEFAULT,))
inv=defaultdict(list)
for r in cur.fetchall(): inv[r['customer_id']].append(r)
cur.execute('''SELECT s.invoice_id FROM sales s WHERE s.status='completed' AND s.appointment_id IS NOT NULL AND s.invoice_id IS NOT NULL''')
appt_inv={r['invoice_id'] for r in cur.fetchall()}

def cid(lead):
    if lead['customer_id']: return lead['customer_id']
    for v in pvars(lead['phone']):
        if v in bp: return bp[v]
    return be.get((lead['email'] or '').strip().lower())

eligible=[]
for lead in leads:
    c=cid(lead)
    if not c: continue
    since=str(lead['external_created_at'] or lead['created_at'])[:10]
    ok=any(i['d']>=since and i['id'] in appt_inv for i in inv.get(c,[]))
    if not ok: continue
    total=sum(float(i['total_amount']) for i in inv.get(c,[]) if i['d']>=since)
    eligible.append((lead, total))

print('Total elegibles (factura cita desde lead):', len(eligible))
for lead,total in eligible:
    name=f"{lead['first_name'] or ''} {lead['last_name'] or ''}".strip()
    in_pres = lead['stage_id']==pres
    print(f"  {'OK' if in_pres else 'PEND'} {name:35} | {st.get(lead['stage_id'],'?')[:25]:25} | {total:.2f}")
conn.close()
