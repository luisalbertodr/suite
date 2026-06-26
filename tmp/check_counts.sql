SELECT style_key, entity_type FROM dunasoft.style_sync_entity_map
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND entity_type = 'customer'
LIMIT 10;

SELECT legacy_codcli, name FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND legacy_codcli IS NOT NULL
LIMIT 5;

SELECT count(*) FROM public.customers WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT count(*) FROM public.articles WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT count(*) FROM public.customer_vouchers WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT count(*) FROM public.sales WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT count(*) FROM public.invoices WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT count(*) FROM public.cash_register_sessions WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
