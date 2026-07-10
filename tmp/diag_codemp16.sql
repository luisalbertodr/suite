WITH active_invoices AS (
  SELECT i.id, i.total_amount, i.issue_date,
    btrim(split_part(m.style_key,'/',4)) AS codcli
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e ON e.company_id = m.company_id AND e.style_key = m.style_key
  WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL AND m.style_key LIKE '2026/%'
),
plan_match AS (
  SELECT ai.id,
    count(p.idplan) AS plan_count,
    min(p.codemp) AS single_codemp
  FROM active_invoices ai
  JOIN dunasoft.plan2009 p
    ON p.fecha = ai.issue_date
   AND ltrim(btrim(p.codcli),'0') = ltrim(btrim(ai.codcli),'0')
   AND p.facturado
  GROUP BY ai.id
)
SELECT
  count(*) AS invoices,
  count(*) FILTER (WHERE plan_count = 1) AS one_plan,
  count(*) FILTER (WHERE plan_count > 1) AS multi_plan,
  count(*) FILTER (WHERE plan_count = 0) AS no_plan
FROM active_invoices ai
LEFT JOIN plan_match pm ON pm.id = ai.id;

-- sales by plan codemp (single match only)
WITH active_invoices AS (
  SELECT i.id, i.total_amount, i.issue_date, btrim(split_part(m.style_key,'/',4)) AS codcli
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e ON e.company_id = m.company_id AND e.style_key = m.style_key
  WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL AND m.style_key LIKE '2026/%'
),
plan_match AS (
  SELECT ai.id, ai.total_amount, p.codemp
  FROM active_invoices ai
  JOIN dunasoft.plan2009 p
    ON p.fecha = ai.issue_date
   AND ltrim(btrim(p.codcli),'0') = ltrim(btrim(ai.codcli),'0')
   AND p.facturado
  WHERE ai.id IN (
    SELECT ai2.id FROM active_invoices ai2
    JOIN dunasoft.plan2009 p2 ON p2.fecha = ai2.issue_date
      AND ltrim(btrim(p2.codcli),'0') = ltrim(btrim(ai2.codcli),'0') AND p2.facturado
    GROUP BY ai2.id HAVING count(*) = 1
  )
)
SELECT coalesce(ae.name, 'Empleada '||pm.codemp) AS name,
  count(*) tickets, round(sum(pm.total_amount)::numeric,2) amount
FROM plan_match pm
LEFT JOIN public.agenda_employees ae ON ae.company_id=dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp,'')),'0'),''),'0')
    = coalesce(nullif(ltrim(btrim(coalesce(pm.codemp,'')),'0'),''),'0')
GROUP BY 1, pm.codemp ORDER BY amount DESC;

-- multi-plan: attribute by distinct codemp count split
WITH active_invoices AS (
  SELECT i.id, i.total_amount, i.issue_date, btrim(split_part(m.style_key,'/',4)) AS codcli
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e ON e.company_id = m.company_id AND e.style_key = m.style_key
  WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL AND m.style_key LIKE '2026/%'
),
plan_lines AS (
  SELECT ai.id, ai.total_amount, p.codemp,
    count(*) OVER (PARTITION BY ai.id) AS plan_lines
  FROM active_invoices ai
  JOIN dunasoft.plan2009 p
    ON p.fecha = ai.issue_date
   AND ltrim(btrim(p.codcli),'0') = ltrim(btrim(ai.codcli),'0')
   AND p.facturado
)
SELECT coalesce(ae.name, 'Empleada '||pl.codemp) AS name,
  count(DISTINCT pl.id) tickets,
  round(sum(pl.total_amount / pl.plan_lines)::numeric,2) amount
FROM plan_lines pl
LEFT JOIN public.agenda_employees ae ON ae.company_id=dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp,'')),'0'),''),'0')
    = coalesce(nullif(ltrim(btrim(coalesce(pl.codemp,'')),'0'),''),'0')
GROUP BY 1, pl.codemp ORDER BY amount DESC;
