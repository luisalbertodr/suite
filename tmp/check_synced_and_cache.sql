SELECT i.number, i.issue_date, i.total_amount, i.status, m.style_key
FROM public.invoices i
LEFT JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
WHERE i.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND i.issue_date >= '2026-06-01' AND i.issue_date < '2026-07-01'
  AND i.number IN ('A-1370','A-1329','A-1354','A-1393','A-1308')
ORDER BY i.number;

DELETE FROM public.dashboard_billing_query_cache
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT month_num, round(total::numeric, 2) AS dashboard
FROM public.dashboard_billing_monthly('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, 2026)
WHERE month_num IN (6, 7);
