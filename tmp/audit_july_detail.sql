\pset format aligned

\echo '=== Julio: Suite por issue_date vs faccab por fecfac (matched numfac) ==='
WITH suite AS (
  SELECT split_part(m.style_key,'/',3) AS numfac,
         i.issue_date::date AS issue_date,
         i.total_amount::numeric AS total
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  WHERE m.style_key LIKE '2026/A/%'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
),
fac AS (
  SELECT btrim(numfac::text) AS numfac,
         fecfac::date AS fecfac,
         coalesce(nullif(regexp_replace(btrim(totfac::text),',','.','g'),'')::numeric,0) AS total
  FROM legacy.faccab
  WHERE btrim(serfac::text)='A' AND btrim(ejefac::text)='2026'
    AND fecfac>='2026-07-01' AND fecfac<'2026-08-01'
)
SELECT
  round(sum(s.total) FILTER (WHERE s.issue_date>='2026-07-01' AND s.issue_date<'2026-08-01')::numeric,2) AS suite_issue_jul,
  round(sum(f.total)::numeric,2) AS faccab_fecfac_jul_legacy,
  count(DISTINCT s.numfac) FILTER (WHERE s.issue_date>='2026-07-01' AND s.issue_date<'2026-08-01') AS suite_nums_jul,
  count(DISTINCT f.numfac) AS faccab_nums_jul_legacy,
  count(*) FILTER (WHERE f.numfac IS NOT NULL AND (s.issue_date<'2026-07-01' OR s.issue_date>='2026-08-01')) AS matched_but_wrong_issue_month
FROM suite s
FULL JOIN fac f ON f.numfac = s.numfac;

\echo '=== Facturas en faccab jul (legacy stale) que Suite tiene con issue_date distinto ==='
SELECT f.numfac, f.fecfac::date, s.issue_date, round(f.totfac::numeric,2) fac, round(s.total_amount::numeric,2) suite
FROM legacy.faccab f
LEFT JOIN (
  SELECT split_part(m.style_key,'/',3) numfac, i.issue_date, i.total_amount
  FROM invoices i JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id
  WHERE m.style_key LIKE '2026/A/%'
) s ON s.numfac = btrim(f.numfac::text)
WHERE f.serfac='A' AND f.fecfac>='2026-07-01' AND f.fecfac<'2026-08-01'
ORDER BY f.fecfac
LIMIT 20;

\echo '=== 2 facturas issue_date 2012 (anomalía) ==='
SELECT i.number, i.issue_date, i.total_amount, m.style_key
FROM invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id
WHERE i.issue_date < '2020-01-01'
  AND m.style_key LIKE '2026/%';
