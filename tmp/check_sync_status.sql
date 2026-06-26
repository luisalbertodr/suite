SELECT tabla, enabled, dbf_baseline_seeded, last_id, last_error
FROM dunasoft.style_sync_cursor
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
ORDER BY tabla;

SELECT entity_type, count(*) AS mapped
FROM dunasoft.style_sync_entity_map
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
GROUP BY entity_type ORDER BY entity_type;

SELECT tabla, count(*) AS huellas
FROM dunasoft.style_sync_dbf_fingerprint
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
GROUP BY tabla ORDER BY tabla;

SELECT 'customers' AS kind, count(*) AS total FROM public.customers WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
UNION ALL SELECT 'articles', count(*) FROM public.articles WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
UNION ALL SELECT 'vouchers', count(*) FROM public.customer_vouchers WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
UNION ALL SELECT 'sales', count(*) FROM public.sales WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
UNION ALL SELECT 'invoices', count(*) FROM public.invoices WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
UNION ALL SELECT 'cash_sessions', count(*) FROM public.cash_sessions WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT agent_version, last_cola_id, last_error, agent_last_tick_at
FROM dunasoft.style_sync_agent_state
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
