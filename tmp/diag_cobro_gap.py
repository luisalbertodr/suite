#!/usr/bin/env python3
"""Citas legacy en Suite con cobro Dunasoft pero sin venta/factura en Suite."""
import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

COMPANY = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

# Citas legacy sin venta
cur.execute(
    """
    SELECT count(*)::bigint AS n
    FROM agenda_appointments a
    WHERE a.company_id = %s
      AND (a.legacy_idplan IS NOT NULL AND btrim(a.legacy_idplan::text) <> ''
           OR a.legacy_planinc_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM sales s
        WHERE s.appointment_id = a.id AND s.status = 'completed'
      )
    """,
    (COMPANY,),
)
print("Citas legacy SIN venta completed:", cur.fetchone()["n"])

# Con legacy.agenda facturado=true
cur.execute(
    """
    SELECT count(*)::bigint AS n
    FROM agenda_appointments a
    JOIN legacy.plan2009 p ON btrim(p.idplan) = btrim(a.legacy_idplan::text)
    LEFT JOIN legacy.agenda g ON btrim(g.idplan) = btrim(a.legacy_idplan::text)
    WHERE a.company_id = %s
      AND btrim(a.legacy_idplan::text) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM sales s WHERE s.appointment_id = a.id AND s.status = 'completed'
      )
      AND (
        upper(coalesce(g.facturado, '')) IN ('T', 'TRUE', '1', 'S', 'SI', 'Y', 'YES')
        OR EXISTS (
          SELECT 1 FROM legacy.faccab f
          WHERE btrim(f.codcli) = btrim(p.codcli)
            AND btrim(f.fecfac) = btrim(p.fecha)
            AND coalesce(nullif(btrim(f.impcob1), ''), '0')::numeric
              + coalesce(nullif(btrim(f.impcob2), ''), '0')::numeric > 0
        )
      )
    """,
    (COMPANY,),
)
print("De esas, con señal facturado/cobro legacy (aprox):", cur.fetchone()["n"])

# Ventas LEG sin factura
cur.execute(
    """
    SELECT count(*)::bigint AS n FROM sales
    WHERE company_id = %s AND status = 'completed' AND invoice_id IS NULL
      AND (ticket_number LIKE 'LEG-%%' OR appointment_id IS NOT NULL)
    """,
    (COMPANY,),
)
print("Ventas completed sin invoice_id:", cur.fetchone()["n"])

# Facturas legacy note prefix ya importadas
cur.execute(
    """
    SELECT count(*)::bigint AS n FROM invoices
    WHERE company_id = %s AND notes LIKE 'Factura legacy sin cita%%'
    """,
    (COMPANY,),
)
print("Facturas 'legacy sin cita' ya en Suite:", cur.fetchone()["n"])

cur.execute("SELECT count(*)::bigint AS n FROM sales WHERE company_id = %s AND ticket_number LIKE 'LEG-%%'", (COMPANY,))
print("Tickets LEG- existentes:", cur.fetchone()["n"])

conn.close()
