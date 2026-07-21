SELECT id::text, name, legacy_codcli
FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    lower(name) LIKE '%josefina%cousillas%'
    OR lower(name) LIKE '%carmen%aldao%'
    OR lower(name) LIKE '%isabel%fernandez%cabaleiro%'
    OR lower(name) LIKE '%isabel%cabaleiro%'
    OR lower(name) LIKE '%alba%alvarez%'
  )
LIMIT 40;
