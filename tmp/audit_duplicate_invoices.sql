\pset format aligned

\echo '=== numfac con más de una factura Suite (2026/A) ==='
SELECT split_part(m.style_key, '/', 3) AS numfac,
       count(DISTINCT m.suite_id) AS invoices,
       round(sum(i.total_amount)::numeric, 2) AS sum_total,
       array_agg(DISTINCT i.number ORDER BY i.number) AS numbers
FROM dunasoft.style_sync_entity_map m
JOIN public.invoices i ON i.id = m.suite_id
WHERE m.entity_type = 'invoice'
  AND m.style_key LIKE '2026/A/%'
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
GROUP BY 1
HAVING count(DISTINCT m.suite_id) > 1
ORDER BY sum(i.total_amount) DESC
LIMIT 20;

\echo '=== Total duplicado por numfac multi-factura ==='
WITH multi AS (
  SELECT split_part(m.style_key, '/', 3) AS numfac,
         sum(i.total_amount) AS sum_total,
         count(DISTINCT m.suite_id) AS n
  FROM dunasoft.style_sync_entity_map m
  JOIN public.invoices i ON i.id = m.suite_id
  WHERE m.entity_type = 'invoice' AND m.style_key LIKE '2026/A/%'
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
  GROUP BY 1
  HAVING count(DISTINCT m.suite_id) > 1
)
SELECT count(*) AS numfac_multi, round(sum(sum_total)::numeric, 2) AS summed
FROM multi;

\echo '=== Maps huérfanos: misma numfac clave vieja y nueva ==='
SELECT m.style_key, i.number, round(i.total_amount::numeric,2), i.status
FROM dunasoft.style_sync_entity_map m
JOIN public.invoices i ON i.id = m.suite_id
WHERE m.entity_type = 'invoice'
  AND split_part(m.style_key, '/', 3) IN (
    SELECT split_part(style_key, '/', 3)
    FROM dunasoft.style_sync_entity_map
    WHERE entity_type = 'invoice' AND style_key LIKE '2026/A/%'
    GROUP BY 1 HAVING count(DISTINCT suite_id) > 1
  )
  AND m.style_key LIKE '%2026/A/%'
ORDER BY split_part(m.style_key, '/', 3), m.style_key
LIMIT 30;

\echo '=== Facturas split M+E (sufijo -M/-E) mismo numfac base ==='
SELECT regexp_replace(number, '-(M|E)$', '') AS base,
       count(*), round(sum(total_amount)::numeric,2)
FROM public.invoices
WHERE number ~ '^A-2026-[0-9]+-(M|E)$'
  AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')
GROUP BY 1
HAVING count(*) > 1
ORDER BY sum(total_amount) DESC
LIMIT 15;

\echo '=== ¿Hay A-2026-N Y A-2026-N-M para mismo N? ==='
SELECT count(*) AS doubled_groups
FROM (
  SELECT regexp_replace(number, '-(M|E)$', '') AS base
  FROM public.invoices
  WHERE number ~ '^A-2026-[0-9]+' AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')
  GROUP BY 1
  HAVING count(*) FILTER (WHERE number ~ '^A-2026-[0-9]+$') > 0
     AND count(*) FILTER (WHERE number ~ '-(M|E)$') > 0
) t;
