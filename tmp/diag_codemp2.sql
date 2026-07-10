-- ¿Hay codemp en otra parte del style_key o en facturas?
SELECT DISTINCT m.style_key
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
  AND array_length(string_to_array(m.style_key, '/'), 1) > 5
LIMIT 20;

-- Columnas invoices relevantes
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='invoices'
  AND column_name ILIKE '%emp%';

-- plan2009 codemp en citas facturadas jul
SELECT p.codemp, count(*), round(sum(coalesce(p.importe,0))::numeric,2)
FROM dunasoft.plan2009 p
WHERE p.fecha BETWEEN '2026-07-01' AND '2026-07-10' AND p.facturado
GROUP BY 1 ORDER BY 3 DESC;

-- facturas con employee en agenda o metadata
SELECT i.id, i.number, i.employee_id, i.metadata
FROM public.invoices i
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
LIMIT 5;
