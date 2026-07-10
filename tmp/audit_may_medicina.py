"""Auditoría Mayo 2026: facturación Medicina real (legacy líneas) vs Suite dashboard."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from apply_sql_migration import load_db_url  # noqa: E402

import psycopg2
from psycopg2.extras import RealDictCursor

MED_BILLING = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
MED_REPORT = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
EST_REPORT = MED_BILLING

# Facturas destacadas en la hoja del usuario (numfac mayo 2026)
HIGHLIGHTED = [923, 930, 938, 986, 1033, 1063, 1065, 1068, 1095, 1099, 1176]

QUERIES = [
    ("=== Dashboard RPC mayo 2026 ===", """
        SELECT 'dashboard_billing_monthly medicina' AS src,
               round(total::numeric, 2) AS total
        FROM dashboard_billing_monthly(%(med)s::uuid, 2026)
        WHERE month_num = 5
        UNION ALL
        SELECT 'dashboard_billing_monthly_split medicina',
               round(total::numeric, 2)
        FROM dashboard_billing_monthly_split(2026)
        WHERE month_num = 5 AND company_id = %(med)s::uuid
        UNION ALL
        SELECT 'dashboard_billing_monthly_by_family medicina',
               round(sum(total)::numeric, 2)
        FROM dashboard_billing_monthly_by_family(2026)
        WHERE month_num = 5 AND report_company_id = %(med_report)s::uuid;
    """),
    ("=== Legacy faccab mayo total ===", """
        SELECT round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS faccab_total,
               count(*) AS faccab_count
        FROM legacy.faccab
        WHERE serfac = 'A' AND fecfac >= '2026-05-01' AND fecfac < '2026-06-01'
          AND upper(btrim(coalesce(anulada, ''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X');
    """),
    ("=== Legacy split medicina por líneas (mayo) ===", """
        WITH med_families AS (
          SELECT name FROM article_families
          WHERE company_id = %(med_report)s::uuid
            AND billing_company_id = %(med)s::uuid
        ),
        med_articles AS (
          SELECT upper(btrim(codigo)) AS cod
          FROM articles a
          WHERE a.company_id = %(med_report)s::uuid
            AND (
              a.billing_company_id = %(med)s::uuid
              OR a.familia IN (SELECT name FROM med_families)
            )
        ),
        legacy_lines AS (
          SELECT
            fc.numfac,
            fc.fecfac::date AS fecfac,
            fc.codcli,
            upper(btrim(fl.codart::text)) AS codart,
            btrim(fl.desart::text) AS desart,
            coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0) AS line_amt
          FROM legacy.faccab fc
          JOIN legacy.faclin fl
            ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
          WHERE btrim(coalesce(fc.serfac::text, '')) = 'A'
            AND fc.fecfac >= '2026-05-01' AND fc.fecfac < '2026-06-01'
            AND upper(btrim(coalesce(fc.anulada::text, ''))) NOT IN
                ('S', 'SI', '1', 'T', 'TRUE', 'Y', 'YES', 'X')
        )
        SELECT
          round(sum(line_amt) FILTER (WHERE codart IN (SELECT cod FROM med_articles) OR upper(desart) ~ '(FOTREJ|FOTORREJ|MANCHA)')::numeric, 2) AS medicina_lines,
          round(sum(line_amt) FILTER (WHERE NOT (codart IN (SELECT cod FROM med_articles) OR upper(desart) ~ '(FOTREJ|FOTORREJ|MANCHA)'))::numeric, 2) AS estetica_lines,
          count(DISTINCT numfac) FILTER (WHERE codart IN (SELECT cod FROM med_articles) OR upper(desart) ~ '(FOTREJ|FOTORREJ|MANCHA)') AS med_invoice_count
        FROM legacy_lines;
    """),
    ("=== Legacy medicina por factura (mayo) ===", """
        WITH med_families AS (
          SELECT name FROM article_families
          WHERE company_id = %(med_report)s::uuid
            AND billing_company_id = %(med)s::uuid
        ),
        med_articles AS (
          SELECT upper(btrim(codigo)) AS cod
          FROM articles a
          WHERE a.company_id = %(med_report)s::uuid
            AND (
              a.billing_company_id = %(med)s::uuid
              OR a.familia IN (SELECT name FROM med_families)
            )
        ),
        legacy_lines AS (
          SELECT
            fc.numfac,
            fc.fecfac::date AS fecfac,
            lpad(btrim(fc.codcli::text), 6, '0') AS codcli,
            upper(btrim(fl.codart::text)) AS codart,
            btrim(fl.desart::text) AS desart,
            coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0) AS line_amt,
            coalesce(nullif(regexp_replace(btrim(fc.totfac::text), ',', '.', 'g'), '')::numeric, 0) AS totfac
          FROM legacy.faccab fc
          JOIN legacy.faclin fl
            ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
          WHERE btrim(coalesce(fc.serfac::text, '')) = 'A'
            AND fc.fecfac >= '2026-05-01' AND fc.fecfac < '2026-06-01'
            AND upper(btrim(coalesce(fc.anulada::text, ''))) NOT IN
                ('S', 'SI', '1', 'T', 'TRUE', 'Y', 'YES', 'X')
        ),
        med_by_inv AS (
          SELECT
            numfac,
            min(fecfac) AS fecfac,
            min(codcli) AS codcli,
            round(sum(line_amt) FILTER (
              WHERE codart IN (SELECT cod FROM med_articles)
                 OR upper(desart) ~ '(FOTREJ|FOTORREJ|MANCHA)'
            )::numeric, 2) AS med_amt,
            round(sum(line_amt)::numeric, 2) AS all_lines,
            round(max(totfac)::numeric, 2) AS totfac,
            string_agg(DISTINCT left(desart, 40), ' | ' ORDER BY left(desart, 40)) FILTER (
              WHERE codart IN (SELECT cod FROM med_articles)
                 OR upper(desart) ~ '(FOTREJ|FOTORREJ|MANCHA)'
            ) AS med_services
          FROM legacy_lines
          GROUP BY numfac
          HAVING sum(line_amt) FILTER (
            WHERE codart IN (SELECT cod FROM med_articles)
               OR upper(desart) ~ '(FOTREJ|FOTORREJ|MANCHA)'
          ) <> 0
        )
        SELECT * FROM med_by_inv ORDER BY numfac;
    """),
    ("=== Suite sync mayo: facturas mapeadas ===", """
        SELECT i.number, i.issue_date::date, round(i.total_amount::numeric, 2) AS amt,
               i.company_id, m.style_key,
               round(coalesce(
                 resolve_invoice_billing_company_id(i.id, %(med_report)s::uuid),
                 i.company_id
               )::text::numeric, 0) AS _dummy
        FROM public.invoices i
        INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
          AND m.company_id = dunasoft.style_sync_hub_company_id()
          AND m.style_key LIKE '2026/%'
        ORDER BY i.number::int NULLS LAST;
    """),
]

HIGHLIGHT_QUERY = """
WITH med_families AS (
  SELECT name FROM article_families
  WHERE company_id = %(med_report)s::uuid AND billing_company_id = %(med)s::uuid
),
med_articles AS (
  SELECT upper(btrim(codigo)) AS cod FROM articles a
  WHERE a.company_id = %(med_report)s::uuid
    AND (a.billing_company_id = %(med)s::uuid OR a.familia IN (SELECT name FROM med_families))
),
legacy_med AS (
  SELECT fc.numfac, fc.fecfac::date AS fecfac, lpad(btrim(fc.codcli::text), 6, '0') AS codcli,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0))
           FILTER (WHERE upper(btrim(fl.codart::text)) IN (SELECT cod FROM med_articles)
                      OR upper(btrim(fl.desart::text)) ~ '(FOTREJ|FOTORREJ|MANCHA)')::numeric, 2) AS med_amt,
         string_agg(DISTINCT left(btrim(fl.desart::text), 35), ' | ') FILTER (
           WHERE upper(btrim(fl.codart::text)) IN (SELECT cod FROM med_articles)
              OR upper(btrim(fl.desart::text)) ~ '(FOTREJ|FOTORREJ|MANCHA)'
         ) AS services
  FROM legacy.faccab fc
  JOIN legacy.faclin fl ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
  WHERE fc.serfac = 'A' AND fc.fecfac >= '2026-05-01' AND fc.fecfac < '2026-06-01'
    AND upper(btrim(coalesce(fc.anulada, ''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
  GROUP BY fc.numfac, fc.fecfac, fc.codcli
  HAVING sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0))
           FILTER (WHERE upper(btrim(fl.codart::text)) IN (SELECT cod FROM med_articles)
                      OR upper(btrim(fl.desart::text)) ~ '(FOTREJ|FOTORREJ|MANCHA)') <> 0
),
suite AS (
  SELECT (regexp_match(m.style_key, '/A/([0-9]+)/'))[1]::int AS numfac,
         i.issue_date::date, round(i.total_amount::numeric, 2) AS suite_amt,
         i.id AS invoice_id, m.style_key,
         public.resolve_invoice_billing_company_id(i.id, %(med_report)s::uuid) AS billing_co
  FROM invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE '2026/A/%'
)
SELECT l.numfac, l.fecfac, l.codcli, l.med_amt AS legacy_med, l.services,
       s.suite_amt, s.issue_date AS suite_date, s.billing_co,
       CASE WHEN s.numfac IS NULL THEN 'SIN SYNC'
            WHEN s.billing_co <> %(med)s::uuid THEN 'CLASIFICADA ESTETICA'
            WHEN abs(coalesce(s.suite_amt, 0) - l.med_amt) > 0.02 THEN 'IMPORTE DISTINTO'
            ELSE 'OK' END AS status
FROM legacy_med l
LEFT JOIN suite s ON s.numfac = l.numfac
ORDER BY l.numfac;
"""

COMPARE_HIGHLIGHTED = """
SELECT l.numfac, l.med_amt, s.suite_amt, s.billing_co,
       CASE WHEN s.numfac IS NULL THEN 'NO EN SUITE'
            WHEN s.billing_co <> %(med)s::uuid THEN 'NO MEDICINA EN SUITE'
            ELSE 'EN SUITE MED' END AS estado
FROM (
  SELECT fc.numfac,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS med_amt
  FROM legacy.faccab fc
  JOIN legacy.faclin fl ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac
  WHERE fc.serfac='A' AND fc.numfac = ANY(%(nums)s)
    AND fc.fecfac >= '2026-05-01' AND fc.fecfac < '2026-06-01'
  GROUP BY fc.numfac
) l
LEFT JOIN (
  SELECT (regexp_match(m.style_key, '/A/([0-9]+)/'))[1]::int AS numfac,
         round(i.total_amount::numeric, 2) AS suite_amt,
         resolve_invoice_billing_company_id(i.id, %(med_report)s::uuid) AS billing_co
  FROM invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  WHERE m.style_key LIKE '2026/A/%'
) s ON s.numfac = l.numfac
ORDER BY l.numfac;
"""


def main() -> None:
    params = {"med": MED_BILLING, "med_report": MED_REPORT, "est": EST_REPORT, "nums": HIGHLIGHTED}
    conn = psycopg2.connect(load_db_url())
    cur = conn.cursor(cursor_factory=RealDictCursor)

    for title, sql in QUERIES:
        print(title)
        try:
            cur.execute(sql, params)
            rows = cur.fetchall()
            if not rows:
                print("  (sin filas)")
            for r in rows:
                print(" ", dict(r))
        except Exception as e:
            conn.rollback()
            print(f"  ERROR: {e}")
        print()

    print("=== Cruce legacy medicina vs Suite (mayo) ===")
    cur.execute(HIGHLIGHT_QUERY, params)
    rows = cur.fetchall()
    legacy_total = sum(float(r["legacy_med"] or 0) for r in rows)
    suite_med_total = sum(
        float(r["suite_amt"] or 0)
        for r in rows
        if r["billing_co"] and str(r["billing_co"]) == MED_BILLING
    )
    missing = [r for r in rows if r["status"] == "SIN SYNC"]
    wrong_co = [r for r in rows if r["status"] == "CLASIFICADA ESTETICA"]
    wrong_amt = [r for r in rows if r["status"] == "IMPORTE DISTINTO"]
    print(f"  Facturas medicina legacy: {len(rows)}, total líneas med: {legacy_total:.2f}")
    print(f"  Suite clasificado medicina: {suite_med_total:.2f}")
    print(f"  Diferencia: {legacy_total - suite_med_total:.2f}")
    print(f"  Sin sync: {len(missing)}, clasificadas estética: {len(wrong_co)}, importe distinto: {len(wrong_amt)}")
    if missing:
        print("\n  --- Sin sincronizar ---")
        for r in missing:
            print(f"    {r['numfac']} {r['fecfac']} cli {r['codcli']} {r['legacy_med']}€ {r['services']}")
    if wrong_co:
        print("\n  --- Clasificadas como Estética en Suite ---")
        for r in wrong_co:
            print(f"    {r['numfac']} legacy_med={r['legacy_med']} suite={r['suite_amt']} {r['services']}")
    if wrong_amt:
        print("\n  --- Importe distinto ---")
        for r in wrong_amt:
            print(f"    {r['numfac']} legacy={r['legacy_med']} suite={r['suite_amt']}")

    print("\n=== Facturas destacadas (hoja usuario) ===")
    cur.execute(COMPARE_HIGHLIGHTED, params)
    for r in cur.fetchall():
        print(" ", dict(r))

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
