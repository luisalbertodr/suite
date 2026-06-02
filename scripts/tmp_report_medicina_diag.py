"""Diagnóstico: reporte facturas Medicina + filtro familias."""
from pathlib import Path
import psycopg2

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"

url = [
    l.split("=", 1)[1].strip().strip('"')
    for l in Path(".env").read_text(encoding="utf-8").splitlines()
    if l.startswith("SUPABASE_DB_URL=")
][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='invoice_items' ORDER BY ordinal_position"
)
ii_cols = [r[0] for r in cur.fetchall()]
print("invoice_items columns:", ii_cols)
art_col = "article_id" if "article_id" in ii_cols else None
if not art_col:
    for c in ii_cols:
        if "article" in c or "product" in c:
            art_col = c
            break
print("article link column:", art_col)

cur.execute(
    """
    SELECT COALESCE(billing_company_id, company_id) AS biller, COUNT(*)
    FROM article_families WHERE company_id = %s GROUP BY 1
    """,
    (ESTETICA,),
)
print("\nFamilias catálogo por biller:")
for biller, n in cur.fetchall():
    print(" ", "MED" if biller == MEDICINA else "EST", n)

cur.execute(
    """
    SELECT name FROM article_families
    WHERE company_id = %s AND COALESCE(billing_company_id, company_id) = %s
    ORDER BY name
    """,
    (ESTETICA, MEDICINA),
)
med_fams = [r[0] for r in cur.fetchall()]
print(f"\nFamilias Medicina en UI ({len(med_fams)}):", med_fams)

cur.execute(
    """
    SELECT COUNT(*) FROM invoices
    WHERE company_id = %s
      AND issue_date >= '2026-05-01' AND issue_date < '2026-06-01'
      AND COALESCE(status, '') NOT IN ('cancelled', 'void', 'anulada')
    """,
    (MEDICINA,),
)
print("\nFacturas Medicina mayo (sin filtro familia):", cur.fetchone()[0])

if art_col:
    cur.execute(
        f"""
        SELECT
          COUNT(*) AS lines,
          COUNT(ii.{art_col}) AS with_art,
          COUNT(*) FILTER (WHERE a.familia IS NOT NULL AND TRIM(a.familia) <> '') AS with_fam
        FROM invoices i
        JOIN invoice_items ii ON ii.invoice_id = i.id
        LEFT JOIN articles a ON a.id = ii.{art_col}
        WHERE i.company_id = %s
          AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
        """,
        (MEDICINA,),
    )
    print("Líneas facturas Medicina mayo:", cur.fetchone())

    for fam in med_fams:
        cur.execute(
            f"""
            SELECT COUNT(*)
            FROM invoices i
            JOIN invoice_items ii ON ii.invoice_id = i.id
            JOIN articles a ON a.id = ii.{art_col}
            WHERE i.company_id = %s
              AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
              AND a.familia = %s
            """,
            (MEDICINA, fam),
        )
        print(f"  líneas familia '{fam}':", cur.fetchone()[0])

# Líneas sin article_id: match por descripción / código
cur.execute(
    """
    SELECT ii.description, COUNT(*)
    FROM invoices i
    JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.company_id = %s
      AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    """,
    (MEDICINA,),
)
print("\nTop descripciones líneas Medicina mayo:")
for d, n in cur.fetchall():
    print(f"  {n}x {d[:80]}")

# Artículos medicina billing en otras familias (nombre familia estética)
cur.execute(
    """
    SELECT DISTINCT a.familia, COUNT(*)
    FROM articles a
    LEFT JOIN article_families af ON af.name = a.familia AND af.company_id = a.company_id
    WHERE a.company_id = %s
      AND COALESCE(a.billing_company_id, af.billing_company_id, a.company_id) = %s
    GROUP BY 1 ORDER BY 2 DESC
    """,
    (ESTETICA, MEDICINA),
)
print("\nFamilias (campo articles.familia) con artículos billing Medicina:")
for fam, n in cur.fetchall():
    print(f"  {n} artículos en familia '{fam}'")

print("\n=== articles.familia vs article_families.name (Medicina) ===")
for fam in med_fams:
    cur.execute(
        """
        SELECT COUNT(*), array_agg(DISTINCT a.familia) FILTER (WHERE a.familia IS NOT NULL)
        FROM articles a
        WHERE a.company_id = %s AND a.familia = %s
        """,
        (ESTETICA, fam),
    )
    print(f"  articles.familia = '{fam}':", cur.fetchone())
    cur.execute(
        """
        SELECT COUNT(*)
        FROM articles a
        JOIN article_families af ON af.company_id = a.company_id AND af.name = %s
        WHERE a.company_id = %s
          AND COALESCE(a.billing_company_id, af.billing_company_id, a.company_id) = %s
        """,
        (fam, ESTETICA, MEDICINA),
    )
    print(f"  articles con billing med en familia catálogo '{fam}':", cur.fetchone()[0])

cur.execute(
    """
    SELECT COUNT(*) FROM articles
    WHERE company_id = %s AND billing_company_id = %s
    """,
    (ESTETICA, MEDICINA),
)
print("\narticles con billing_company_id=Medicina:", cur.fetchone()[0])

cur.execute(
    """
    SELECT a.familia, COUNT(*)
    FROM articles a
    WHERE a.company_id = %s AND a.billing_company_id = %s
    GROUP BY 1 ORDER BY 2 DESC
    """,
    (ESTETICA, MEDICINA),
)
print("\narticles.familia con billing_company_id=Medicina:")
for r in cur.fetchall():
    print(" ", r)

for code in ["00259", "025", "00256", "laserme"]:
    cur.execute(
        "SELECT codigo, familia, billing_company_id FROM articles WHERE company_id=%s AND upper(trim(codigo))=upper(%s)",
        (ESTETICA, code),
    )
    print(f"\narticulos codigo {code}:", cur.fetchall())

conn.close()
