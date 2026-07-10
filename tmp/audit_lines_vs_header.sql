\pset format aligned

\echo '=== Cabecera vs líneas 2026 (style sync) ==='
WITH si AS (
  SELECT i.id, i.total_amount
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  WHERE m.style_key LIKE '2026/%'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
)
SELECT count(*) AS invoices,
       count(*) FILTER (WHERE abs(coalesce(li.lines_sum,0) - si.total_amount) > 0.05) AS mismatch,
       round(sum(si.total_amount)::numeric,2) AS header_total,
       round(sum(coalesce(li.lines_sum,0))::numeric,2) AS lines_total,
       round(sum(coalesce(li.lines_sum,0) - si.total_amount)::numeric,2) AS lines_minus_header
FROM si
LEFT JOIN LATERAL (
  SELECT sum(ii.total_price) AS lines_sum FROM public.invoice_items ii WHERE ii.invoice_id = si.id
) li ON true;

\echo '=== Top facturas donde líneas > cabecera ==='
WITH si AS (
  SELECT i.id, i.number, i.total_amount
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  WHERE m.style_key LIKE '2026/%'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
)
SELECT si.number, round(si.total_amount::numeric,2) header,
       round(sum(ii.total_price)::numeric,2) lines,
       round((sum(ii.total_price)-si.total_amount)::numeric,2) diff
FROM si
JOIN public.invoice_items ii ON ii.invoice_id = si.id
GROUP BY si.id, si.number, si.total_amount
HAVING sum(ii.total_price) - si.total_amount > 1
ORDER BY sum(ii.total_price) - si.total_amount DESC
LIMIT 15;

\echo '=== Caché dashboard billing ==='
SELECT cache_key, company_id::text, round((payload->>'totals')::text::numeric, 2) err, updated_at
FROM public.dashboard_billing_cache
ORDER BY updated_at DESC
LIMIT 10;

\echo '=== Julio 2026: RPC vs sum cabeceras ==='
SELECT 'rpc monthly' src, total FROM dashboard_billing_monthly('816af484-92a0-4f65-a5a7-1c907aa4bb3d', 2026) WHERE month_num=7
UNION ALL
SELECT 'sum headers', round(sum(i.total_amount)::numeric,2)
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE m.style_key LIKE '2026/%' AND i.issue_date>='2026-07-01' AND i.issue_date<'2026-08-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada');

\echo '=== Mes actual parcial: comparar totfac live style-sync payload vs invoice ==='
SELECT round(avg(i.total_amount)::numeric,2) avg_inv, round(max(i.total_amount)::numeric,2) max_inv, count(*)
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE i.issue_date >= date_trunc('month', current_date)::date;
