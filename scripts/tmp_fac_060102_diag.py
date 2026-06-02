"""Diagnóstico FAC-060102 / cita 04-05-2026 / 00259."""
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

E = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text(encoding="utf-8").splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor(cursor_factory=RealDictCursor)

for num in ("FAC-060102", "FAC_060102", "060102"):
    cur.execute(
        """
        SELECT i.id, i.number, i.issue_date, i.total_amount, i.company_id::text,
               c.name AS cliente, i.notes
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.number ILIKE %s OR i.number ILIKE %s
        LIMIT 5
        """,
        (f"%{num}%", f"%060102%"),
    )
    rows = cur.fetchall()
    if rows:
        print(f"\n=== Factura match {num} ===")
        for r in rows:
            print(dict(r))
            inv_id = r["id"]
            cur.execute(
                "SELECT description, quantity, total_price FROM invoice_items WHERE invoice_id=%s",
                (inv_id,),
            )
            for li in cur.fetchall():
                print("  line:", dict(li))

cur.execute(
    """
    SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.client_name,
           a.description, a.legacy_planinc_id
    FROM agenda_appointments a
    WHERE a.company_id = %s
      AND a.appointment_date = '2026-05-04'
      AND a.client_name ILIKE '%%Patricia%%Alvari%%'
    ORDER BY a.start_time
    """,
    (E,),
)
appts = cur.fetchall()
print(f"\n=== Citas Patricia 04/05: {len(appts)} ===")
for apt in appts:
    print(" ", apt["start_time"], apt["client_name"][:30] if apt["client_name"] else "", apt["description"][:50] if apt["description"] else "", "planinc", apt["legacy_planinc_id"])
    cur.execute(
        """
        SELECT kind, label, duration_minutes, article_id, notes,
               (SELECT codigo FROM articles WHERE id = ai.article_id) AS codigo
        FROM appointment_items ai WHERE appointment_id = %s ORDER BY sort_order
        """,
        (apt["id"],),
    )
    for it in cur.fetchall():
        print("    item:", dict(it))

# legacy planinc 04/05 con 259 o mesoterapia
cur.execute(
    """
    SELECT idplaninc, idplan, fecha, horini, horfin, codcli, nomcli, planart, texto, tipinc
    FROM legacy.planinc
    WHERE fecha = '2026-05-04'
    ORDER BY horini
    LIMIT 20
    """
)
print("\n=== legacy.planinc 04/05 (primeras 20) ===")
for r in cur.fetchall():
    pa = str(r.get("planart") or "")[:40]
    tx = str(r.get("texto") or "")[:40]
    if "259" in pa or "259" in tx or "meso" in pa.lower() or "meso" in tx.lower() or "lipol" in pa.lower():
        print(" *", dict(r))
    else:
        print("  ", r["horini"], r["nomcli"], pa or tx)

# planart 00259
cur.execute(
    """
    SELECT idplan, codart, hora, artcom FROM legacy.planart
    WHERE codart ILIKE '%%259%%' OR codart ILIKE '%%00259%%'
    LIMIT 15
    """
)
print("\n=== legacy.planart cod 259 ===")
for r in cur.fetchall():
    print(dict(r))

cur.execute(
    "SELECT id, codigo, descripcion, precio, duration_minutes, legacy_codart FROM articles WHERE company_id=%s AND (codigo ILIKE '%%259%%' OR legacy_codart ILIKE '%%259%%')",
    (E,),
)
print("\n=== articles 259 ===")
for r in cur.fetchall():
    print(dict(r))

# ticket LEG-109997
cur.execute(
    """
    SELECT s.id, s.ticket_number, s.total_amount, s.appointment_id, s.invoice_id, s.notes
    FROM sales s WHERE s.ticket_number ILIKE '%%109997%%' OR s.notes ILIKE '%%109997%%'
    LIMIT 5
    """
)
print("\n=== Sale LEG-109997 ===")
for r in cur.fetchall():
    print(dict(r))
    if r.get("appointment_id"):
        cur.execute(
            "SELECT kind, label, duration_minutes, article_id, notes FROM appointment_items WHERE appointment_id=%s",
            (r["appointment_id"],),
        )
        for it in cur.fetchall():
            print("  apt item:", dict(it))

# ventas/facturas ligadas a citas del 04/05
cur.execute(
    """
    SELECT s.ticket_number, s.total_amount, s.appointment_id, s.invoice_id, i.number AS inv_num
    FROM sales s
    LEFT JOIN invoices i ON i.id = s.invoice_id
    WHERE s.appointment_id IN (
      SELECT id FROM agenda_appointments WHERE company_id=%s AND appointment_date='2026-05-04'
    )
    LIMIT 20
    """,
    (E,),
)
print("\n=== sales citas 04/05 ===")
for r in cur.fetchall():
    print(dict(r))

# planinc 411984 y idplan 109997
for pid in ("411984", "109997"):
    cur.execute(
        "SELECT idplaninc, idplan, fecha, horini, horfin, codcli, nomcli, planart, texto FROM legacy.planinc WHERE idplaninc::text=%s OR idplan=%s LIMIT 10",
        (pid, pid),
    )
    print(f"\n=== legacy.planinc {pid} ===")
    for r in cur.fetchall():
        print(dict(r))

# citas con items sin article_id el 04/05
cur.execute(
    """
    SELECT a.id, a.client_name, a.start_time, ai.label, ai.duration_minutes, ai.article_id, ai.notes
    FROM agenda_appointments a
    JOIN appointment_items ai ON ai.appointment_id = a.id
    WHERE a.company_id = %s AND a.appointment_date = '2026-05-04'
      AND ai.article_id IS NULL
    LIMIT 20
    """,
    (E,),
)
print("\n=== Items SIN article_id 04/05 ===")
for r in cur.fetchall():
    print(dict(r))

cur.execute(
    """
    SELECT a.id, a.client_name, ai.label, ai.duration_minutes, ai.article_id,
           ar.codigo, ar.precio
    FROM agenda_appointments a
    JOIN appointment_items ai ON ai.appointment_id = a.id
    LEFT JOIN articles ar ON ar.id = ai.article_id
    WHERE a.legacy_planinc_id = 411984 OR a.description ILIKE '%%411984%%'
    """,
)
print("\n=== Cita planinc 411984 ===")
for r in cur.fetchall():
    print(dict(r))

# Paula FAC-060098 (500) idplan 109974
cur.execute(
    "SELECT horini, horfin, planart, texto, idplaninc FROM legacy.planinc WHERE idplan='109974' AND fecha='2026-05-04' ORDER BY idplaninc"
)
print("\n=== planinc idplan 109974 (Paula 500€) ===")
for r in cur.fetchall():
    print(dict(r))
cur.execute("SELECT codart, hora FROM legacy.planart WHERE idplan='109974'")
print("planart rows:", cur.fetchall())
cur.execute(
    """
    SELECT a.id, a.client_name, ai.label, ai.duration_minutes, ai.article_id, ai.notes,
           i.number, i.total_amount
    FROM agenda_appointments a
    JOIN appointment_items ai ON ai.appointment_id = a.id
    LEFT JOIN sales s ON s.appointment_id = a.id
    LEFT JOIN invoices i ON i.id = s.invoice_id
    WHERE a.id = 'f9198938-2aaf-4b3b-964c-e517fb557046'
    """
)
print("\n=== Cita Paula / FAC-060098 ===")
for r in cur.fetchall():
    print(dict(r))

cur.execute(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='appointment_items' ORDER BY 1"
)
print("\n=== appointment_items columns ===", [r["column_name"] for r in cur.fetchall()])

for inv in ("FAC-060102", "FAC-060098"):
    cur.execute(
        """
        SELECT ai.label, ai.duration_minutes, ai.article_id, ai.unit_price, ai.notes,
               ar.codigo, a.client_name
        FROM appointment_items ai
        JOIN agenda_appointments a ON a.id = ai.appointment_id
        LEFT JOIN articles ar ON ar.id = ai.article_id
        JOIN sales s ON s.appointment_id = a.id
        JOIN invoices i ON i.id = s.invoice_id
        WHERE i.number = %s
        """,
        (inv,),
    )
    print(f"\n=== Post-repair {inv} ===")
    for r in cur.fetchall():
        print(dict(r))

conn.close()
