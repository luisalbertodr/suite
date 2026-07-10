SELECT id, legacy_codcli, name, tax_id, phone
FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND upper(replace(coalesce(tax_id,''), '-', '')) IN ('32793227B', '32397791Z');
