-- Facturas duplicadas julio: existen en invoices pero sin entity_map
SELECT i.id, i.number, i.issue_date, i.grand_total, i.status
FROM public.invoices i
WHERE i.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND i.number IN ('A-1475','A-1476','A-1478','A-1479','A-1511');

SELECT m.style_key, m.suite_id
FROM dunasoft.style_sync_entity_map m
WHERE m.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND m.entity_type = 'invoice'
  AND (m.style_key LIKE '%/1475/%' OR m.style_key LIKE '%/1476/%' OR m.style_key LIKE '%/1478/%' OR m.style_key LIKE '%/1479/%' OR m.style_key LIKE '%/1511/%');
