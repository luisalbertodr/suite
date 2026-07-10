SELECT id, legacy_codcli, name, tax_id
FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (name ILIKE '%loli%' OR tax_id ILIKE '%32397791%');

INSERT INTO dunasoft.style_sync_entity_map (company_id, entity_type, style_key, suite_id, updated_at)
VALUES
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 'customer', '8201', '3a15fe6d-917b-4485-a910-445b55c2d4ed', now()),
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 'customer', '008201', '3a15fe6d-917b-4485-a910-445b55c2d4ed', now())
ON CONFLICT (company_id, entity_type, style_key) DO UPDATE SET suite_id = EXCLUDED.suite_id, updated_at = now();
