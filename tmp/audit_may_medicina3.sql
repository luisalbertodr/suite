\pset format aligned

\echo '=== Mayo 2026: medicina real TODAS las facturas (legacy líneas) ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id)
SELECT
  round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
    WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )::numeric,2) AS medicina_mayo,
  round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
    WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  )::numeric,2) AS estetica_mayo
FROM legacy.faccab fc
JOIN legacy.faclin fl ON fl.numfac=fc.numfac AND fl.serfac=fc.serfac AND fl.ejefac=fc.ejefac
CROSS JOIN hub
WHERE fc.serfac='A' AND fc.fecfac>='2026-05-01' AND fc.fecfac<'2026-06-01'
  AND upper(btrim(coalesce(fc.anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X');

\echo '=== Mayo 2026: medicina Suite TODAS (invoice_items) ==='
SELECT
  round(sum(ii.total_price) FILTER (
    WHERE dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )::numeric,2) AS suite_medicina_mayo,
  round(sum(ii.total_price) FILTER (
    WHERE dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  )::numeric,2) AS suite_estetica_mayo
FROM invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
JOIN invoice_items ii ON ii.invoice_id=i.id
WHERE i.issue_date>='2026-05-01' AND i.issue_date<'2026-06-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%';

\echo '=== Hoja usuario: gap medicina legacy vs Suite por factura ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id),
nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::text AS numfac
),
legacy_med AS (
  SELECT fc.numfac,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )::numeric,2) AS med_amt,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
         )::numeric,2) AS est_amt
  FROM legacy.faccab fc JOIN legacy.faclin fl ON fl.numfac=fc.numfac AND fl.serfac=fc.serfac
  CROSS JOIN hub
  WHERE fc.serfac='A' AND fc.numfac IN (SELECT numfac FROM nums) AND fc.fecfac>='2026-05-01' AND fc.fecfac<'2026-06-01'
  GROUP BY fc.numfac
),
suite_med AS (
  SELECT (regexp_match(m.style_key, '/A/([0-9]+)/'))[1] AS numfac,
         round(sum(ii.total_price) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )::numeric,2) AS suite_med,
         round(sum(ii.total_price) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
         )::numeric,2) AS suite_est
  FROM invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  JOIN invoice_items ii ON ii.invoice_id=i.id
  WHERE i.issue_date>='2026-05-01' AND i.issue_date<'2026-06-01'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
    AND m.style_key LIKE '2026/A/%'
  GROUP BY 1
)
SELECT l.numfac, l.med_amt AS real_med, coalesce(s.suite_med,0) AS suite_med,
       round(l.med_amt-coalesce(s.suite_med,0),2) AS gap_med,
       l.est_amt AS real_est, coalesce(s.suite_est,0) AS suite_est
FROM legacy_med l
LEFT JOIN suite_med s ON s.numfac=l.numfac
WHERE l.med_amt<>0 OR l.est_amt<>0 OR coalesce(s.suite_med,0)<>0 OR coalesce(s.suite_est,0)<>0
ORDER BY abs(l.med_amt-coalesce(s.suite_med,0)) DESC;

\echo '=== Totales hoja ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id),
nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::text AS numfac
),
legacy AS (
  SELECT round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )::numeric,2) AS med,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
         )::numeric,2) AS est
  FROM legacy.faccab fc JOIN legacy.faclin fl ON fl.numfac=fc.numfac AND fl.serfac=fc.serfac
  CROSS JOIN hub
  WHERE fc.serfac='A' AND fc.numfac IN (SELECT numfac FROM nums) AND fc.fecfac>='2026-05-01' AND fc.fecfac<'2026-06-01'
),
suite AS (
  SELECT round(sum(ii.total_price) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )::numeric,2) AS med,
         round(sum(ii.total_price) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
         )::numeric,2) AS est
  FROM invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  JOIN invoice_items ii ON ii.invoice_id=i.id
  WHERE i.issue_date>='2026-05-01' AND i.issue_date<'2026-06-01'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
    AND m.style_key LIKE '2026/A/%'
    AND (regexp_match(m.style_key, '/A/([0-9]+)/'))[1] IN (SELECT numfac FROM nums)
)
SELECT 'legacy hoja' src, l.med, l.est FROM legacy l
UNION ALL SELECT 'suite hoja', s.med, s.est FROM suite s
UNION ALL SELECT 'gap medicina', l.med-s.med, NULL FROM legacy l, suite s;

\echo '=== Factura 986 duplicada ==='
SELECT i.number, i.issue_date::date, i.total_amount, i.company_id, m.style_key
FROM invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id
WHERE m.style_key LIKE '%/986/%' AND i.issue_date>='2026-05-01' AND i.issue_date<'2026-06-01';
