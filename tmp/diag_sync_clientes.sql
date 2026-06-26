SELECT name, legacy_codcli, updated_at
FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND name ILIKE '%Luis%Alberto%D%az%'
LIMIT 5;

SELECT tabla, enabled, last_id, last_error, last_ok_at
FROM dunasoft.style_sync_cursor
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla = 'clientes';

SELECT * FROM public.style_sync_agent_status('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4');
