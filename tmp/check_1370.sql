SELECT style_key, suite_id
FROM dunasoft.style_sync_entity_map
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND entity_type = 'invoice'
  AND style_key LIKE '2026/A/1370%';

SELECT id, company_id, number, issue_date, total_amount, status
FROM public.invoices
WHERE number LIKE '%1370%'
  AND issue_date >= '2026-06-01'
ORDER BY issue_date;
