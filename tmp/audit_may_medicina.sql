\pset format aligned
\timing off

\echo '=== Dashboard RPC mayo 2026 ==='
SELECT 'dashboard_billing_monthly medicina' AS src,
       round(total::numeric, 2) AS total
FROM dashboard_billing_monthly('816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid, 2026)
WHERE month_num = 5
UNION ALL
SELECT 'dashboard_billing_monthly_split medicina',
       round(total::numeric, 2)
FROM dashboard_billing_monthly_split(2026)
WHERE month_num = 5 AND company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
UNION ALL
SELECT 'dashboard_billing_monthly_by_family medicina',
       round(sum(total)::numeric, 2)
FROM dashboard_billing_monthly_by_family(2026)
WHERE month_num = 5 AND report_company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid;

\echo '=== Legacy faccab mayo total ==='
SELECT round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS faccab_total,
       count(*) AS faccab_count
FROM legacy.faccab
WHERE serfac = 'A' AND fecfac >= '2026-05-01' AND fecfac < '2026-06-01'
  AND upper(btrim(coalesce(anulada, ''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X');

\echo '=== Legacy split medicina por líneas (mayo) ==='
WITH med_families AS (
  SELECT name FROM article_families
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
),
med_articles AS (
  SELECT upper(btrim(codigo)) AS cod
  FROM articles a
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND (
      a.billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      OR a.familia IN (SELECT name FROM med_families)
    )
),
legacy_lines AS (
  SELECT
    fc.numfac,
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

\echo '=== Cruce: legacy medicina vs Suite (mayo) - solo discrepancias ==='
WITH med_families AS (
  SELECT name FROM article_families
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
),
med_articles AS (
  SELECT upper(btrim(codigo)) AS cod FROM articles a
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND (a.billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         OR a.familia IN (SELECT name FROM med_families))
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
         public.resolve_invoice_billing_company_id(i.id, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS billing_co
  FROM invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE '2026/A/%'
)
SELECT l.numfac, l.fecfac, l.codcli, l.med_amt AS legacy_med, l.services,
       s.suite_amt, s.issue_date AS suite_date,
       CASE WHEN s.numfac IS NULL THEN 'SIN SYNC'
            WHEN s.billing_co <> '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid THEN 'CLASIFICADA ESTETICA'
            WHEN abs(coalesce(s.suite_amt, 0) - l.med_amt) > 0.02 THEN 'IMPORTE DISTINTO'
            ELSE 'OK' END AS status
FROM legacy_med l
LEFT JOIN suite s ON s.numfac = l.numfac
WHERE s.numfac IS NULL
   OR s.billing_co <> '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
   OR abs(coalesce(s.suite_amt, 0) - l.med_amt) > 0.02
ORDER BY l.numfac;

\echo '=== Totales cruce ==='
WITH med_families AS (
  SELECT name FROM article_families WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
),
med_articles AS (
  SELECT upper(btrim(codigo)) AS cod FROM articles a
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND (a.billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid OR a.familia IN (SELECT name FROM med_families))
),
legacy_med AS (
  SELECT fc.numfac,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0))
           FILTER (WHERE upper(btrim(fl.codart::text)) IN (SELECT cod FROM med_articles)
                      OR upper(btrim(fl.desart::text)) ~ '(FOTREJ|FOTORREJ|MANCHA)')::numeric, 2) AS med_amt
  FROM legacy.faccab fc
  JOIN legacy.faclin fl ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
  WHERE fc.serfac = 'A' AND fc.fecfac >= '2026-05-01' AND fc.fecfac < '2026-06-01'
    AND upper(btrim(coalesce(fc.anulada, ''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
  GROUP BY fc.numfac
  HAVING sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0))
           FILTER (WHERE upper(btrim(fl.codart::text)) IN (SELECT cod FROM med_articles)
                      OR upper(btrim(fl.desart::text)) ~ '(FOTREJ|FOTORREJ|MANCHA)') <> 0
),
suite AS (
  SELECT (regexp_match(m.style_key, '/A/([0-9]+)/'))[1]::int AS numfac,
         round(i.total_amount::numeric, 2) AS suite_amt,
         resolve_invoice_billing_company_id(i.id, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS billing_co
  FROM invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE '2026/A/%'
)
SELECT
  round(sum(l.med_amt)::numeric, 2) AS legacy_med_total,
  round(sum(s.suite_amt) FILTER (WHERE s.billing_co = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid)::numeric, 2) AS suite_med_total,
  round((sum(l.med_amt) - coalesce(sum(s.suite_amt) FILTER (WHERE s.billing_co = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid), 0))::numeric, 2) AS gap,
  count(*) FILTER (WHERE s.numfac IS NULL) AS sin_sync,
  count(*) FILTER (WHERE s.billing_co IS NOT NULL AND s.billing_co <> '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid) AS clasif_estetica
FROM legacy_med l
LEFT JOIN suite s ON s.numfac = l.numfac;

\echo '=== Facturas destacadas hoja usuario ==='
WITH nums AS (SELECT unnest(ARRAY[923,930,938,986,1033,1063,1065,1068,1095,1099,1176]) AS numfac),
legacy_med AS (
  SELECT fc.numfac,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS med_amt,
         string_agg(left(btrim(fl.desart::text), 30), ' | ') AS services
  FROM legacy.faccab fc
  JOIN legacy.faclin fl ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac
  WHERE fc.serfac='A' AND fc.numfac IN (SELECT numfac FROM nums)
    AND fc.fecfac >= '2026-05-01' AND fc.fecfac < '2026-06-01'
  GROUP BY fc.numfac
),
suite AS (
  SELECT (regexp_match(m.style_key, '/A/([0-9]+)/'))[1]::int AS numfac,
         round(i.total_amount::numeric, 2) AS suite_amt,
         i.issue_date::date,
         resolve_invoice_billing_company_id(i.id, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS billing_co
  FROM invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  WHERE m.style_key LIKE '2026/A/%'
)
SELECT n.numfac, l.med_amt, l.services, s.suite_amt, s.issue_date,
       CASE WHEN s.numfac IS NULL THEN 'NO EN SUITE'
            WHEN s.billing_co <> '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid THEN 'EN SUITE COMO ESTETICA'
            ELSE 'OK MEDICINA' END AS estado
FROM nums n
LEFT JOIN legacy_med l ON l.numfac = n.numfac
LEFT JOIN suite s ON s.numfac = n.numfac
ORDER BY n.numfac;

\echo '=== Legacy medicina todas las facturas mayo ==='
WITH med_families AS (
  SELECT name FROM article_families WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
),
med_articles AS (
  SELECT upper(btrim(codigo)) AS cod FROM articles a
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND (a.billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid OR a.familia IN (SELECT name FROM med_families))
)
SELECT fc.numfac, fc.fecfac::date, lpad(btrim(fc.codcli::text), 6, '0') AS codcli,
       round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0))
         FILTER (WHERE upper(btrim(fl.codart::text)) IN (SELECT cod FROM med_articles)
                    OR upper(btrim(fl.desart::text)) ~ '(FOTREJ|FOTORREJ|MANCHA)')::numeric, 2) AS med_amt,
       string_agg(DISTINCT left(btrim(fl.desart::text), 28), ' | ') FILTER (
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
ORDER BY fc.numfac;
