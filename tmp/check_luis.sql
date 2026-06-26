SELECT name, phone, email, updated_at
FROM public.customers
WHERE legacy_codcli = '000553'
  AND company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT count(*) AS sin_mapear
FROM (
  SELECT 1
  FROM public.customers c
  WHERE c.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND NOT EXISTS (
      SELECT 1 FROM dunasoft.style_sync_entity_map m
      WHERE m.company_id = c.company_id
        AND m.entity_type = 'customer'
        AND ltrim(m.style_key, '0') = ltrim(c.legacy_codcli, '0')
    )
) x;
