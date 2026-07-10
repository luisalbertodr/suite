\pset format aligned
\timing off

\echo '=== Dashboard RPC monthly 2026 ==='
SELECT month_num, round(sum(total)::numeric, 2) AS total
FROM dashboard_billing_monthly('816af484-92a0-4f65-a5a7-1c907aa4bb3d', 2026)
GROUP BY 1 ORDER BY 1;

\echo '=== Dashboard RPC split 2026 (M+E) ==='
SELECT month_num, company_id::text, round(total::numeric, 2) AS total
FROM dashboard_billing_monthly_split(2026)
ORDER BY 1, 2;

\echo '=== legacy.faccab serie A 2026 ==='
SELECT to_char(fecfac::date, 'YYYY-MM') AS ym,
       round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS total,
       count(*) AS docs
FROM legacy.faccab
WHERE btrim(coalesce(serfac::text, '')) = 'A'
  AND fecfac::date >= '2026-01-01' AND fecfac::date < '2026-08-01'
  AND upper(btrim(coalesce(anulada::text, ''))) NOT IN ('S', 'SI', '1', 'T', 'TRUE', 'Y', 'YES', 'X', 'ANULADA', 'A')
GROUP BY 1 ORDER BY 1;

\echo '=== Invoices style-sync jul 2026: cabecera vs líneas ==='
WITH style_inv AS (
  SELECT i.id, i.total_amount
  FROM public.invoices i
  INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  WHERE i.issue_date >= '2026-07-01' AND i.issue_date < '2026-08-01'
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE '2026/%'
)
SELECT round(sum(si.total_amount)::numeric, 2) AS invoice_total,
       round(sum(ii.total_price)::numeric, 2) AS lines_total,
       count(DISTINCT si.id) AS invoices,
       count(ii.id) AS lines
FROM style_inv si
LEFT JOIN public.invoice_items ii ON ii.invoice_id = si.id;

\echo '=== Duplicados legacy A-N vs A-2026-N (activos) ==='
SELECT count(*) AS legacy_an_count,
       round(sum(total_amount)::numeric, 2) AS legacy_an_total
FROM public.invoices i
WHERE i.number ~ '^A-[0-9]+$'
  AND extract(year FROM i.issue_date) = 2026
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada');

\echo '=== Mapeos style_key sin prefijo ejefac (2026) ==='
SELECT count(*) AS bad_maps
FROM dunasoft.style_sync_entity_map m
WHERE m.entity_type = 'invoice'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.style_key ~ '^A/'
  AND NOT m.style_key ~ '^[0-9]{4}/';
