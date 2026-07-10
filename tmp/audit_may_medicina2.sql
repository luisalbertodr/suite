\pset format aligned

\echo '=== Dashboard mayo 2026 todas las vistas ==='
SELECT 'monthly hub estetica co' AS src, round(total::numeric,2) FROM dashboard_billing_monthly('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, 2026) WHERE month_num=5
UNION ALL SELECT 'monthly hub medicina co', round(total::numeric,2) FROM dashboard_billing_monthly('816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid, 2026) WHERE month_num=5
UNION ALL SELECT 'monthly work center', round(total::numeric,2) FROM dashboard_billing_monthly(dunasoft.style_sync_hub_company_id(), 2026) WHERE month_num=5
UNION ALL SELECT 'split medicina co', round(total::numeric,2) FROM dashboard_billing_monthly_split(2026) WHERE month_num=5 AND company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
UNION ALL SELECT 'split estetica co', round(total::numeric,2) FROM dashboard_billing_monthly_split(2026) WHERE month_num=5 AND company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
UNION ALL SELECT 'by_family report medicina', round(sum(total)::numeric,2) FROM dashboard_billing_monthly_by_family(2026) WHERE month_num=5 AND report_company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
UNION ALL SELECT 'by_family report estetica', round(sum(total)::numeric,2) FROM dashboard_billing_monthly_by_family(2026) WHERE month_num=5 AND report_company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid;

\echo '=== Hoja usuario: facturas mayo (totfac faccab) ==='
WITH nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::text AS numfac
)
SELECT f.numfac, f.fecfac::date, lpad(btrim(f.codcli::text),6,'0') AS codcli,
       round(coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric,0)::numeric,2) AS totfac,
       string_agg(left(btrim(fl.desart::text),28), ' | ' ORDER BY fl.desart) AS lineas
FROM legacy.faccab f
JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac AND fl.ejefac=f.ejefac
WHERE f.serfac='A' AND f.numfac IN (SELECT numfac FROM nums)
  AND f.fecfac>='2026-05-01' AND f.fecfac<'2026-06-01'
GROUP BY f.numfac, f.fecfac, f.codcli, f.totfac
ORDER BY f.numfac::int;

\echo '=== Suma hoja usuario (faccab totfac) ==='
WITH nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::text AS numfac
)
SELECT round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric,0))::numeric,2) AS suma_hoja,
       count(*) AS n
FROM legacy.faccab WHERE serfac='A' AND numfac IN (SELECT numfac FROM nums)
  AND fecfac>='2026-05-01' AND fecfac<'2026-06-01';

\echo '=== Suite: facturas hoja en issue_date mayo ==='
WITH nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::int AS numfac
)
SELECT n.numfac,
       i.issue_date::date AS suite_date,
       f.fecfac::date AS faccab_date,
       round(i.total_amount::numeric,2) AS suite_amt,
       round(coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric,0)::numeric,2) AS faccab_amt,
       i.company_id,
       m.style_key,
       CASE WHEN i.id IS NULL THEN 'NO SYNC' WHEN i.issue_date::date < '2026-05-01' OR i.issue_date::date >= '2026-06-01' THEN 'FECHA SUITE FUERA MAYO' ELSE 'OK FECHA' END AS fecha_ok
FROM nums n
LEFT JOIN dunasoft.style_sync_entity_map m ON m.entity_type='invoice' AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/A/' || n.numfac::text || '/%'
LEFT JOIN invoices i ON i.id=m.suite_id AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
LEFT JOIN legacy.faccab f ON f.serfac='A' AND f.numfac=n.numfac::text AND f.fecfac>='2026-05-01' AND f.fecfac<'2026-06-01'
ORDER BY n.numfac;

\echo '=== Líneas medicina por factura hoja (billing_company_id en artículo) ==='
WITH nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::text AS numfac
),
hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id),
line_data AS (
  SELECT f.numfac,
         btrim(fl.desart::text) AS desart,
         upper(btrim(fl.codart::text)) AS codart,
         coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0) AS subtot,
         public.dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id) AS line_billing_co
  FROM legacy.faccab f
  JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac AND fl.ejefac=f.ejefac
  CROSS JOIN hub
  WHERE f.serfac='A' AND f.numfac IN (SELECT numfac FROM nums)
    AND f.fecfac>='2026-05-01' AND f.fecfac<'2026-06-01'
)
SELECT numfac,
       round(sum(subtot) FILTER (WHERE line_billing_co='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid)::numeric,2) AS med_line_amt,
       round(sum(subtot) FILTER (WHERE line_billing_co='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)::numeric,2) AS est_line_amt,
       round(sum(subtot)::numeric,2) AS total_lines
FROM line_data
GROUP BY numfac
ORDER BY numfac::int;

\echo '=== Suma líneas medicina hoja (resolve_line) ==='
WITH nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::text AS numfac
),
hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id)
SELECT round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
         WHERE public.dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
       )::numeric,2) AS med_real_hoja
FROM legacy.faccab f
JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac AND fl.ejefac=f.ejefac
CROSS JOIN hub
WHERE f.serfac='A' AND f.numfac IN (SELECT numfac FROM nums)
  AND f.fecfac>='2026-05-01' AND f.fecfac<'2026-06-01';

\echo '=== Suite invoice_items medicina hoja ==='
WITH nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::int AS numfac
),
inv AS (
  SELECT n.numfac, i.id, i.issue_date::date, round(i.total_amount::numeric,2) AS tot
  FROM nums n
  JOIN dunasoft.style_sync_entity_map m ON m.entity_type='invoice' AND m.company_id=dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE '2026/A/' || n.numfac::text || '/%'
  JOIN invoices i ON i.id=m.suite_id
  WHERE lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
    AND i.issue_date>='2026-05-01' AND i.issue_date<'2026-06-01'
)
SELECT inv.numfac,
       round(sum(ii.total_price) FILTER (
         WHERE public.dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
       )::numeric,2) AS suite_med_lines,
       round(sum(ii.total_price)::numeric,2) AS suite_all_lines,
       inv.tot AS suite_header
FROM inv
JOIN invoice_items ii ON ii.invoice_id=inv.id
GROUP BY inv.numfac, inv.tot
ORDER BY inv.numfac;

\echo '=== Facturas hoja SIN sync o fecha fuera mayo ==='
WITH nums AS (
  SELECT unnest(ARRAY[908,911,913,923,927,929,930,931,932,938,968,969,970,971,986,993,996,997,998,1001,1002,1031,1032,1033,1038,1043,1045,1047,1049,1061,1063,1064,1065,1066,1068,1093,1095,1096,1097,1099,1100,1101,1129,1143,1145,1176])::int AS numfac
)
SELECT n.numfac, f.fecfac::date, round(coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric,0)::numeric,2) AS faccab_amt,
       i.issue_date::date AS suite_date, round(i.total_amount::numeric,2) AS suite_amt,
       CASE WHEN i.id IS NULL THEN 'NO SYNC'
            WHEN i.issue_date::date < '2026-05-01' OR i.issue_date::date >= '2026-06-01' THEN 'FECHA SUITE OTRO MES'
            ELSE 'SYNC OK' END AS estado
FROM nums n
JOIN legacy.faccab f ON f.serfac='A' AND f.numfac=n.numfac::text AND f.fecfac>='2026-05-01' AND f.fecfac<'2026-06-01'
LEFT JOIN dunasoft.style_sync_entity_map m ON m.entity_type='invoice' AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/A/' || n.numfac::text || '/%'
LEFT JOIN invoices i ON i.id=m.suite_id AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
WHERE i.id IS NULL OR i.issue_date::date < '2026-05-01' OR i.issue_date::date >= '2026-06-01'
ORDER BY n.numfac;

\echo '=== Destacadas amarillo: detalle ==='
WITH nums AS (SELECT unnest(ARRAY[923,930,938,986,1033,1063,1065,1068,1095,1099,1176])::text AS numfac),
hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id)
SELECT f.numfac, f.fecfac::date,
       round(coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric,0)::numeric,2) AS totfac,
       i.issue_date::date AS suite_date, round(i.total_amount::numeric,2) AS suite_amt,
       round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
         WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
       )::numeric,2) AS med_lines,
       string_agg(left(btrim(fl.desart::text),25), ' | ') AS servicios
FROM legacy.faccab f
JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac
CROSS JOIN hub
LEFT JOIN dunasoft.style_sync_entity_map m ON m.entity_type='invoice' AND m.style_key LIKE '2026/A/'||f.numfac||'/%'
LEFT JOIN invoices i ON i.id=m.suite_id
WHERE f.serfac='A' AND f.numfac IN (SELECT numfac FROM nums)
GROUP BY f.numfac, f.fecfac, f.totfac, i.issue_date, i.total_amount
ORDER BY f.numfac::int;
