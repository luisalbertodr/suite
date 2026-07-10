WITH active_invoices AS (
  SELECT i.id, i.total_amount, i.number, i.issue_date,
    btrim(split_part(m.style_key, '/', 1)) AS ejefac,
    btrim(split_part(m.style_key, '/', 2)) AS serfac,
    btrim(split_part(m.style_key, '/', 3)) AS numfac,
    btrim(split_part(m.style_key, '/', 4)) AS codcli
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e ON e.company_id = m.company_id AND e.style_key = m.style_key
  WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL AND m.style_key LIKE '2026/%'
),
plan_lines AS (
  SELECT ai.id
  FROM active_invoices ai
  JOIN dunasoft.plan2009 p ON p.fecha = ai.issue_date
   AND ltrim(btrim(p.codcli::text),'0') = ltrim(btrim(ai.codcli),'0') AND p.facturado
)
SELECT ai.number, ai.total_amount
FROM active_invoices ai
LEFT JOIN plan_lines pl ON pl.id = ai.id
WHERE pl.id IS NULL;
