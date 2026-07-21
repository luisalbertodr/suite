SELECT name, legacy_codcli, id::text, created_at::text
FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    lower(name) IN (
      'mar lamas pernas',
      'santiago rojo martinez',
      'maria cambon',
      'paqui fernández',
      'paqui fernandez'
    )
    OR lower(name) LIKE '%concepci%n garc%a dabrio%'
    OR lower(name) LIKE 'maria concepcion garcia dabrio%'
  )
ORDER BY created_at DESC NULLS LAST, name;
