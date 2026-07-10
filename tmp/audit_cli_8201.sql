-- Clientes 8196/8201: buscar por teléfono o legacy
SELECT id, legacy_codcli, first_name, last_name, phone
FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    legacy_codcli IN ('8196','8201','008196','008201')
    OR phone LIKE '%'
  )
ORDER BY legacy_codcli
LIMIT 20;

SELECT style_key, suite_id FROM dunasoft.style_sync_entity_map
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND entity_type = 'customer'
  AND style_key IN ('8196','8201','008196','008201');

SELECT number, status, issue_date, total_amount
FROM public.invoices
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND number IN ('A-1512','A-2026-1512');
