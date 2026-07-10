\pset format aligned

\echo '=== Junio 2026: faccab por día ==='
SELECT fecfac::date AS d, round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS total, count(*)
FROM legacy.faccab
WHERE serfac='A' AND fecfac>='2026-06-01' AND fecfac<'2026-07-01'
  AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
GROUP BY 1 ORDER BY 1;

\echo '=== Junio 2026: invoices style-sync por día (issue_date) ==='
SELECT i.issue_date::date AS d, round(sum(i.total_amount)::numeric, 2) AS total, count(*)
FROM public.invoices i
INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE i.issue_date>='2026-06-01' AND i.issue_date<'2026-07-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%'
GROUP BY 1 ORDER BY 1;

\echo '=== Top 15 facturas junio Suite por importe ==='
SELECT i.number, i.issue_date::date, round(i.total_amount::numeric,2) AS amt, m.style_key
FROM public.invoices i
INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE i.issue_date>='2026-06-01' AND i.issue_date<'2026-07-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%'
ORDER BY i.total_amount DESC NULLS LAST
LIMIT 15;

\echo '=== Facturas junio en Suite cuyo fecfac faccab NO es junio ==='
SELECT i.number, i.issue_date::date AS suite_date, f.fecfac::date AS faccab_date,
       round(i.total_amount::numeric,2) AS amt, m.style_key
FROM public.invoices i
INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
LEFT JOIN legacy.faccab f ON f.serfac='A'
  AND m.style_key = f.ejefac::text || '/' || btrim(f.serfac::text) || '/' || f.numfac::text || '/' || btrim(f.codcli::text)
WHERE i.issue_date>='2026-06-01' AND i.issue_date<'2026-07-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%'
  AND (f.fecfac IS NULL OR f.fecfac::date < '2026-06-01' OR f.fecfac::date >= '2026-07-01')
ORDER BY i.total_amount DESC NULLS LAST
LIMIT 20;

\echo '=== Mes actual (jul) parcial: faccab vs Suite ==='
SELECT 'faccab jul' AS src, round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric,0))::numeric,2), count(*)
FROM legacy.faccab WHERE serfac='A' AND fecfac>='2026-07-01' AND fecfac<'2026-08-01'
  AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
UNION ALL
SELECT 'suite jul', round(sum(i.total_amount)::numeric,2), count(*)
FROM public.invoices i
INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE i.issue_date>='2026-07-01' AND i.issue_date<'2026-08-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%';
