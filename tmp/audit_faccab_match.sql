\pset format aligned

\echo '=== Estado legacy.faccab (última fecfac, conteos) ==='
SELECT max(fecfac::date) AS max_fecfac, min(fecfac::date) AS min_fecfac_2026, count(*) FILTER (WHERE fecfac>='2026-01-01') AS rows_2026
FROM legacy.faccab WHERE serfac='A';

\echo '=== ¿Existe numfac 1339 en legacy.faccab? ==='
SELECT ejefac, serfac, numfac, codcli, fecfac::date, totfac
FROM legacy.faccab WHERE numfac=1339 AND serfac='A' ORDER BY fecfac DESC LIMIT 5;

\echo '=== Enero-mayo: suma totfac faccab vs total_amount Suite (por numfac) ==='
WITH fac AS (
  SELECT f.numfac::int AS numfac,
         f.fecfac::date AS fecfac,
         coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric, 0) AS totfac
  FROM legacy.faccab f
  WHERE f.serfac='A' AND f.ejefac=2026
    AND f.fecfac>='2026-01-01' AND f.fecfac<'2026-06-01'
    AND upper(btrim(coalesce(f.anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
),
inv AS (
  SELECT split_part(split_part(m.style_key, '/', 3), '/', 1)::int AS numfac,
         i.issue_date::date AS issue_date,
         i.total_amount::numeric AS total
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  WHERE m.style_key LIKE '2026/A/%'
    AND i.issue_date>='2026-01-01' AND i.issue_date<'2026-06-01'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
)
SELECT count(*) AS matched,
       round(sum(f.totfac)::numeric,2) AS faccab_sum,
       round(sum(i.total)::numeric,2) AS suite_sum,
       round(sum(i.total - f.totfac)::numeric,2) AS diff,
       count(*) FILTER (WHERE abs(i.total - f.totfac) > 0.02) AS mismatched
FROM fac f
JOIN inv i ON i.numfac = f.numfac;

\echo '=== Facturas con diff > 1 EUR (ene-may) ==='
WITH fac AS (
  SELECT f.numfac::int AS numfac,
         coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric, 0) AS totfac
  FROM legacy.faccab f
  WHERE f.serfac='A' AND f.ejefac=2026 AND f.fecfac>='2026-01-01' AND f.fecfac<'2026-06-01'
),
inv AS (
  SELECT split_part(split_part(m.style_key, '/', 3), '/', 1)::int AS numfac,
         i.number, i.total_amount::numeric AS total
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  WHERE m.style_key LIKE '2026/A/%' AND i.issue_date>='2026-01-01' AND i.issue_date<'2026-06-01'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
)
SELECT i.number, f.numfac, round(f.totfac,2) faccab, round(i.total,2) suite, round(i.total-f.totfac,2) diff
FROM fac f JOIN inv i ON i.numfac=f.numfac
WHERE abs(i.total - f.totfac) > 1
ORDER BY abs(i.total - f.totfac) DESC
LIMIT 15;

\echo '=== Dashboard: facturas junio+ sin fila en legacy.faccab ==='
SELECT count(*) AS suite_only, round(sum(i.total_amount)::numeric,2) AS total
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
LEFT JOIN legacy.faccab f ON f.ejefac=2026 AND f.serfac='A'
  AND f.numfac::text = split_part(split_part(m.style_key, '/', 3), '/', 1)
WHERE m.style_key LIKE '2026/A/%'
  AND i.issue_date>='2026-06-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  AND f.numfac IS NULL;

\echo '=== Serie distinta de A en style_sync (2026) ==='
SELECT split_part(m.style_key, '/', 2) AS serie, count(*), round(sum(i.total_amount)::numeric,2)
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE m.style_key LIKE '2026/%'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
GROUP BY 1 ORDER BY 3 DESC;
